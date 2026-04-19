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

import jwt

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
    Mint a long-lived (30-day) JWT for MCP clients.

    Payload is intentionally identical to the Node.js access-token shape
    ({ "id": user_id }) so the same verify_token() works for both.
    A "scope": "mcp" claim distinguishes these from short-lived web tokens.
    """
    now = datetime.datetime.now(tz=datetime.timezone.utc)
    payload = {
        "id":    user_id,
        "scope": "mcp",
        "iat":   now,
        "exp":   now + datetime.timedelta(days=30),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _extract_bearer(scope: dict) -> str | None:
    """Return the raw Bearer token string from the ASGI scope headers, or None."""
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
      2. Extract the Bearer token from the Authorization header.
      3. Verify the JWT and extract user_id from payload["id"].
      4. Set user_id_var in the current context BEFORE forwarding the
         request — this propagates correctly into anyio thread workers
         (where sync FastMCP tool handlers run).
      5. Return 401 JSON on missing/invalid tokens.

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

        # ── Extract & verify JWT ──────────────────────────────────────────
        raw_token = _extract_bearer(scope)

        if raw_token is None:
            resp = _json_response(
                {"error": "Authorization: Bearer <token> header is required"},
                401,
            )
            await resp(receive, send)
            return

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

        # ── Inject user_id into this request's async context ─────────────
        token_ctx = user_id_var.set(user_id)
        try:
            await self.app(scope, receive, send)
        finally:
            user_id_var.reset(token_ctx)
