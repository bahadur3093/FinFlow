#!/usr/bin/env python3
"""
main.py — FinFlow MCP Server entry-point (uvicorn / Render).

Wires together:
  • FastMCP ASGI app  (SSE transport, all finance tools)
  • AuthMiddleware    (JWT verification, injects user_id into ContextVar)
  • POST /auth/token  (email+password → long-lived MCP JWT, public route)
  • GET  /health      (liveness probe, public route)

Environment variables required
───────────────────────────────
  DATABASE_URL  — PostgreSQL connection string (same as finflow-server)
  JWT_SECRET    — MUST match the value used by finflow-server

Start locally:
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

import json
import os

import bcrypt
import uvicorn
from starlette.applications import Starlette
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Mount, Route

from auth import AuthMiddleware, create_mcp_token
from mcp_server import connection_pool, mcp

# ─────────────────────────────────────────────
# DB HELPER (sync, runs outside of tool context)
# ─────────────────────────────────────────────

def _query_sync(sql: str, params: tuple = ()):
    """Thin wrapper used only by the auth endpoint (not tool handlers)."""
    import psycopg2.extras
    conn = connection_pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            conn.commit()
            try:
                return [dict(r) for r in cur.fetchall()]
            except Exception:
                return []
    except Exception:
        conn.rollback()
        raise
    finally:
        connection_pool.putconn(conn)

# ─────────────────────────────────────────────
# PUBLIC ENDPOINTS
# ─────────────────────────────────────────────

async def health(request: Request) -> JSONResponse:
    return JSONResponse({"status": "ok"})


async def token_endpoint(request: Request) -> JSONResponse:
    """
    POST /auth/token
    Body: { "email": "...", "password": "..." }

    Returns a 30-day MCP-scoped JWT on success.
    Use this token as  Authorization: Bearer <token>  in your MCP client config.

    The password is verified against the bcrypt hash stored by finflow-server,
    so there is no separate credential — it is the same account.
    """
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "Request body must be JSON"}, status_code=400)

    email    = str(body.get("email", "")).strip().lower()
    password = str(body.get("password", ""))

    if not email or not password:
        return JSONResponse(
            {"error": "email and password are required"},
            status_code=400,
        )

    rows = _query_sync(
        'SELECT id, password FROM "User" WHERE LOWER(email) = %s',
        (email,),
    )
    if not rows:
        # Constant-time-ish: still run bcrypt to avoid timing oracle
        bcrypt.checkpw(b"dummy", bcrypt.hashpw(b"dummy", bcrypt.gensalt()))
        return JSONResponse({"error": "Invalid credentials"}, status_code=401)

    user = rows[0]
    stored_hash = user["password"]

    # bcryptjs (Node.js) and Python bcrypt use the same $2b$ format
    if not bcrypt.checkpw(password.encode(), stored_hash.encode()):
        return JSONResponse({"error": "Invalid credentials"}, status_code=401)

    token = create_mcp_token(user["id"])
    return JSONResponse({
        "token":   token,
        "user_id": user["id"],
        "expires": "30 days",
        "usage":   "Authorization: Bearer <token>",
    })

# ─────────────────────────────────────────────
# ASGI APP ASSEMBLY
# ─────────────────────────────────────────────

# FastMCP 2.5+ exposes http_app() for custom ASGI mounting.
# The default transport is SSE; pass transport="sse" explicitly if needed.
_mcp_asgi = mcp.http_app(transport="sse")

# Wrap the MCP app in auth middleware so every MCP request is verified.
# Public routes (/auth/token, /health) are NOT wrapped — they are handled
# directly by Starlette before the middleware sees them.
_protected_mcp = AuthMiddleware(_mcp_asgi)

_starlette_app = Starlette(
    routes=[
        Route("/health",     endpoint=health,          methods=["GET"]),
        Route("/auth/token", endpoint=token_endpoint,  methods=["POST"]),
        # Everything else → protected FastMCP (SSE + /messages)
        Mount("/",           app=_protected_mcp),
    ],
)

# CORS — required so Claude.ai's browser-side connectivity check can reach the
# server. The SSE connection itself is proxied server-side, but the initial URL
# validation and OPTIONS preflight come from the browser.
app = CORSMiddleware(
    _starlette_app,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# ─────────────────────────────────────────────
# ENTRYPOINT
# ─────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"✅ FinFlow MCP Server v3.0 running on port {port}")
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        # Reload only locally; Render sets PORT automatically
        reload=os.environ.get("ENV") == "development",
    )
