"""Authentication routes — password login with session cookies."""

import secrets
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from server.config import APP_PASSWORD, API_KEY

router = APIRouter()

# In-memory session store (single-user, restarts clear sessions)
_sessions: dict[str, bool] = {}


def verify_session(token: str | None) -> bool:
    """Check if a session token is valid."""
    if not token:
        return False
    return _sessions.get(token, False)


def verify_api_key(key: str | None) -> bool:
    """Check if an API key is valid."""
    if not key or not API_KEY:
        return False
    return key == API_KEY


@router.post("/auth/login")
async def login(request: Request):
    body = await request.json()
    password = body.get("password", "")

    if password != APP_PASSWORD:
        return JSONResponse(status_code=401, content={"detail": "Invalid password."})

    token = secrets.token_hex(32)
    _sessions[token] = True

    response = JSONResponse(content={"status": "ok"})
    response.set_cookie(
        key="f1league_token",
        value=token,
        httponly=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 30,  # 30 days
    )
    return response


@router.get("/auth/check")
async def check(request: Request):
    token = request.cookies.get("f1league_token")
    if verify_session(token):
        return {"authenticated": True}
    return JSONResponse(status_code=401, content={"authenticated": False})


@router.post("/auth/logout")
async def logout(request: Request):
    token = request.cookies.get("f1league_token")
    if token and token in _sessions:
        del _sessions[token]
    response = JSONResponse(content={"status": "ok"})
    response.delete_cookie("f1league_token")
    return response
