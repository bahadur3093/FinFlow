"""
auth.py — JWT verification + pure-ASGI auth middleware for the FinFlow MCP server.

Design notes
────────────
• Uses a *pure ASGI* middleware (not Starlette's BaseHTTPMiddleware) so that
  ContextVar values propagate correctly through the ASGI call stack and into
  anyio thread-pool workers (where sync FastMCP tool handlers execute).

• JWT structure mirrors the Node.js finflow-server:
      { "id": "<userId>", "iat": <unix>, "exp": <unix> }
  signed with the same JWT_SECRET env-var.

• A separate /auth/token endpoint (wired in main.py) issues long-lived
  MCP tokens (30 days) so that users don't have to refresh every 15 min.

• Tokens minted by the Node.js /api/auth/mcp-token endpoint carry
      { "id": ..., "scope": "mcp", "type": "persistent" }
  and are stored in the McpToken DB table so they can be hard-revoked
  when the user regenerates their URL.  The middleware checks the DB for
  these tokens.  Older password-based /auth/token tokens bypass the check.

• SSE connections pass the token as a query-string parameter:
      /sse?token=<jwt>
  The middleware reads that before falling back to the Authorization header.

Public surface
──────────────
  user_id_var   — ContextVar[str]: read this inside every tool handler
  AuthMiddleware — pure-ASGI class; wrap the FastMCP ASGI app with it
  verify_token  — decode + validate a JWT, raise jwt.PyJWTError on failure
  create_mcp_token — mint a 30-day MCP-scoped JWT for a given user_id
"""

import contextvars
import datetime
import json
import os
import threading
import urllib.parse

import jwt
import psycopg2
import psycopg2.pool

# ─────────────────────────────────────────────
# CONTEXT
# ─────────────────────────────────────────────

#: Set by AuthMiddleware on every authenticated request.
#: Tool handlers call  user_id_var.get()  to obtain the current user's ID.
user_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("user_id")

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────

JWT_SECRET    = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"

# Paths that bypass auth (exact match, no trailing slash needed)
PUBLIC_PATHS = frozenset({"/auth/token", "/health"})

# ─────────────────────────────────────────────
# DB CONNECTION POOL (for revocation checks)
# ─────────────────────────────────────────────

_pool: "psycopg2.pool.ThreadedConnectionPool | None" = None
_pool_lock = threading.Lock()


def _get_pool() -> psycopg2.pool.ThreadedConnectionPool:
    global _pool
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                _pool = psycopg2.pool.ThreadedConnectionPool(
                    1, 3, os.environ["DATABASE_URL"]
                )
    return _pool


def _is_token_active(token: str, user_id: str) -> bool:
    """
    Return True if *token* is still the current active MCP token for *user_id*.

    Only called for tokens with type=="persistent" (minted by the Node.js
    /api/auth/mcp-token endpoint and stored in the McpToken table).
    Fails open (returns True) on any DB error so availability is not impacted
    by transient DB issues.
    """
    try:
        p = _get_pool()
        conn = p.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    'SELECT id FROM "McpToken" WHERE "userId" = %s AND token = %s',
                    (user_id, token),
                )
                return cur.fetchone() is not None
        finally:
            p.putconn(conn)
    except Exception:
        return True  # fail open — a DB hiccup should not block all requests

# ─────────────────────────────────────────────
# JWT HELPERS
# ─────────────────────────────────────────────

def verify_token(token: str) -> dict:
    """
    Decode and verify *token* using JWT_SECRET.
    Returns the decoded payload dict.
    Raises jwt.PyJWTError (or subclass) on any failure.
    """
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


def create_mcp_token(user_id: str) -> str:
    """
    Mint a long-lived (30-day) JWT for MCP clients that authenticate via
    the /auth/token password endpoint.

    Payload is intentionally identical to the Node.js access-token shape
    ({ "id": user_id }) so the same verify_token() works for both.
    A "scope": "mcp" claim distinguishes these from short-lived web tokens.
    These tokens do NOT carry type:"persistent" and are NOT stored in the DB,
    so they are not subject to the revocation DB check.
    """
    now = datetime.datetime.now(tz=datetime.timezone.utc)
    payload = {
        "id":    user_id,
        "scope": "mcp",
        "iat":   now,
        "exp":   now + datetime.timedelta(days=30),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _extract_token(scope: dict) -> str | None:
    """
    Extract the raw JWT string from the request.

    Checks in order:
    1. ?token=<jwt> query-string parameter  (used by SSE MCP URL connections)
    2. Authorization: Bearer <jwt> header   (used by MCP clients / direct API)
    """
    # ── Query string ──────────────────────────────────────────────────────
    qs = scope.get("query_string", b"").decode("latin-1")
    if qs:
        params = urllib.parse.parse_qs(qs)
        token_list = params.get("token", [])
        if token_list:
            return token_list[0].strip()

    # ── Authorization header ──────────────────────────────────────────────
    headers: list[tuple[bytes, bytes]] = scope.get("headers", [])
    for name, value in headers:
        if name.lower() == b"authorization":
            decoded = value.decode("latin-1")
            if decoded.startswith("Bearer "):
                return decoded[7:].strip()
    return None


def _json_response(body: dict, status: int):
    """Minimal ASGI-compatible JSON response (no Starlette dependency)."""
    raw = json.dumps(body).encode()

    async def send_response(receive, send):  # noqa: D401
        await send({
            "type":    "http.response.start",
            "status":  status,
            "headers": [
                (b"content-type",   b"application/json"),
                (b"content-length", str(len(raw)).encode()),
            ],
        })
        await send({"type": "http.response.body", "body": raw})

    return send_response

# ─────────────────────────────────────────────
# PURE-ASGI MIDDLEWARE
# ─────────────────────────────────────────────

class AuthMiddleware:
    """
    Pure-ASGI auth middleware.

    For every HTTP/WebSocket request:
      1. Skip auth for PUBLIC_PATHS.
      2. Extract the JWT from ?token= query param or Authorization header.
      3. Verify the JWT signature and extract user_id from payload["id"].
      4. For tokens with type=="persistent": verify the token is still the
         active one in the McpToken DB table (hard revocation support).
      5. Set user_id_var in the current context BEFORE forwarding the
         request — this propagates correctly into anyio thread workers
         (where sync FastMCP tool handlers run).
      6. Return 401 JSON on missing/invalid/revoked tokens.

    WebSocket and lifespan scopes are passed through unchanged.
    """

    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send) -> None:
        # Pass non-HTTP scopes straight through (lifespan, websocket setup, …)
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")

        # ── Public routes — no token required ─────────────────────────────
        if path in PUBLIC_PATHS:
            await self.app(scope, receive, send)
            return

        # ── Extract JWT ───────────────────────────────────────────────────
        raw_token = _extract_token(scope)

        if raw_token is None:
            resp = _json_response(
                {"error": "Token required: pass ?token=<jwt> or Authorization: Bearer <token>"},
                401,
            )
            await resp(receive, send)
            return

        # ── Verify JWT signature ──────────────────────────────────────────
        try:
            payload = verify_token(raw_token)
            # Node.js server stores the user id under the "id" key
            user_id = payload.get("id") or payload.get("userId") or payload.get("user_id")
            if not user_id:
                raise ValueError("JWT payload contains no user id")
        except (jwt.PyJWTError, ValueError):
            resp = _json_response({"error": "Invalid or expired token"}, 401)
            await resp(receive, send)
            return

        # ── Revocation check for persistent (URL-based) tokens ────────────
        if payload.get("type") == "persistent":
            if not _is_token_active(raw_token, user_id):
                resp = _json_response(
                    {"error": "Token has been revoked — regenerate your MCP URL"},
                    401,
                )
                await resp(receive, send)
                return

        # ── Inject user_id into this request's async context ─────────────
        token_ctx = user_id_var.set(user_id)
        try:
            await self.app(scope, receive, send)
        finally:
            user_id_var.reset(token_ctx)
