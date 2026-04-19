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
  and are stored in the McpToken DB table so they can be hard-revoked.

SSE two-request flow
────────────────────
  Claude.ai (and other SSE MCP clients) make two kinds of requests:

  1.  GET  /sse?token=<jwt>         — long-lived SSE connection
      The token is in the query string.  The middleware validates it and,
      while streaming the response, captures the sessionId that FastMCP
      embeds in the first "endpoint" SSE event.  The mapping
      sessionId → user_id is stored in _sessions.

  2.  POST /messages?sessionId=<id> — individual tool calls
      No token is present.  The middleware looks up the sessionId in
      _sessions and re-uses the already-validated user_id.

Public surface
──────────────
  user_id_var    — ContextVar[str]: read this inside every tool handler
  AuthMiddleware — pure-ASGI class; wrap the FastMCP ASGI app with it
  verify_token   — decode + validate a JWT, raise jwt.PyJWTError on failure
  create_mcp_token — mint a 30-day MCP-scoped JWT for a given user_id
"""

import contextvars
import datetime
import json
import os
import re
import threading
import time
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

# Paths that bypass auth entirely (exact match)
PUBLIC_PATHS = frozenset({"/auth/token", "/health"})

# ─────────────────────────────────────────────
# SESSION STORE  (SSE sessionId → user_id)
# ─────────────────────────────────────────────

# FastMCP assigns a unique sessionId per SSE connection and embeds it in the
# first "endpoint" SSE event.  Claude.ai then POSTs to
#   /messages?sessionId=<id>
# without repeating the token.  We capture the mapping here so those POSTs
# can be authenticated without requiring the token a second time.

_sessions: dict[str, tuple[str, float]] = {}   # sessionId -> (user_id, created_at)
_SESSION_TTL = 86_400.0                         # 24 hours


def _cleanup_sessions() -> None:
    """Remove sessions older than SESSION_TTL.  Called lazily on new connections."""
    cutoff = time.monotonic() - _SESSION_TTL
    expired = [sid for sid, (_, ts) in _sessions.items() if ts < cutoff]
    for sid in expired:
        del _sessions[sid]

# ─────────────────────────────────────────────
# DB CONNECTION POOL  (revocation checks)
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
    Return True if *token* is still the current active McpToken for *user_id*.
    Only called for tokens carrying type=="persistent".
    Fails open on any DB error so availability is not impacted by transient issues.
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
        return True  # fail open

# ─────────────────────────────────────────────
# JWT HELPERS
# ─────────────────────────────────────────────

def verify_token(token: str) -> dict:
    """Decode and verify *token*.  Raises jwt.PyJWTError on any failure."""
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


def create_mcp_token(user_id: str) -> str:
    """
    Mint a long-lived (30-day) JWT for MCP clients that authenticate via
    the /auth/token password endpoint.

    Does NOT carry type:"persistent" — not stored in DB, no revocation check.
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
    Extract the raw JWT from the request.

    Order of precedence:
    1. ?token=<jwt>   query-string param  (SSE URL connections)
    2. Authorization: Bearer <jwt> header (direct API / MCP clients)
    """
    qs = scope.get("query_string", b"").decode("latin-1")
    if qs:
        params = urllib.parse.parse_qs(qs)
        token_list = params.get("token", [])
        if token_list:
            return token_list[0].strip()

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

    async def send_response(receive, send):
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
    Pure-ASGI auth middleware supporting both token-based and session-based auth.

    Request handling
    ────────────────
    1. PUBLIC_PATHS                       → pass through, no auth
    2. POST /messages?sessionId=<id>      → look up _sessions; 401 if not found
    3. GET  /sse?token=<jwt>              → verify JWT, capture sessionId from
                                            FastMCP's SSE response, store in _sessions
    4. Any other request with ?token= or  → verify JWT (+ revocation check for
       Authorization: Bearer <token>        type==persistent tokens)
    5. Anything else                      → 401
    """

    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return

        path   = scope.get("path", "")
        method = scope.get("method", "")

        # ── 1. Public routes ──────────────────────────────────────────────
        if path in PUBLIC_PATHS:
            await self.app(scope, receive, send)
            return

        qs     = scope.get("query_string", b"").decode("latin-1")
        params = urllib.parse.parse_qs(qs)

        # ── 2. POST /messages/?session_id=<id>  (no token present) ──────
        if (
            method == "POST"
            and "session_id" in params
            and "token" not in params
            and _extract_token(scope) is None
        ):
            session_id = params["session_id"][0]
            entry = _sessions.get(session_id)
            if not entry:
                resp = _json_response(
                    {"error": "Session not found or expired — reconnect your MCP URL"},
                    401,
                )
                await resp(receive, send)
                return
            user_id, _ = entry
            ctx = user_id_var.set(user_id)
            try:
                await self.app(scope, receive, send)
            finally:
                user_id_var.reset(ctx)
            return

        # ── 3 & 4. Token-based auth ───────────────────────────────────────
        raw_token = _extract_token(scope)

        if raw_token is None:
            resp = _json_response(
                {"error": "Token required: pass ?token=<jwt> or Authorization: Bearer <token>"},
                401,
            )
            await resp(receive, send)
            return

        try:
            payload = verify_token(raw_token)
            user_id = (
                payload.get("id")
                or payload.get("userId")
                or payload.get("user_id")
            )
            if not user_id:
                raise ValueError("JWT payload contains no user id")
        except (jwt.PyJWTError, ValueError):
            resp = _json_response({"error": "Invalid or expired token"}, 401)
            await resp(receive, send)
            return

        # Hard-revocation check for persistent URL tokens
        if payload.get("type") == "persistent":
            if not _is_token_active(raw_token, user_id):
                resp = _json_response(
                    {"error": "Token has been revoked — regenerate your MCP URL"},
                    401,
                )
                await resp(receive, send)
                return

        # ── 3. SSE GET — capture sessionId from FastMCP's response ────────
        if method == "GET" and "/sse" in path:
            _cleanup_sessions()
            captured_uid = user_id
            captured_session_id: str | None = None

            async def capturing_send(message):
                nonlocal captured_session_id
                if (
                    captured_session_id is None
                    and message.get("type") == "http.response.body"
                ):
                    body = message.get("body", b"")
                    m = re.search(rb"session_id=([A-Za-z0-9_\-]+)", body)
                    if m:
                        captured_session_id = m.group(1).decode()
                        _sessions[captured_session_id] = (captured_uid, time.monotonic())
                await send(message)

            ctx = user_id_var.set(user_id)
            try:
                await self.app(scope, receive, capturing_send)
            finally:
                user_id_var.reset(ctx)
                # Remove session when the SSE connection closes
                if captured_session_id:
                    _sessions.pop(captured_session_id, None)
            return

        # ── 4. All other authenticated requests ───────────────────────────
        ctx = user_id_var.set(user_id)
        try:
            await self.app(scope, receive, send)
        finally:
            user_id_var.reset(ctx)
