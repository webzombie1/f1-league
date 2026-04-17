"""FastAPI backend for F1 League Tracker."""

import logging
import os
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from server.db import init_db
from server.routes import health, auth, admin, standings, races, drivers, teams, seasons, articles
from server.routes.auth import verify_session, verify_api_key


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    init_db()
    logging.info("F1 League Tracker started.")
    yield
    logging.info("F1 League Tracker shutting down.")


app = FastAPI(title="F1 League Tracker", version="1.0.0", lifespan=lifespan)

# CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    """Protect admin API routes."""
    path = request.url.path

    # Admin routes require auth (cookie session or API key)
    if path.startswith("/api/admin"):
        token = request.cookies.get("f1league_token")
        api_key = request.headers.get("X-API-Key")

        if not verify_session(token) and not verify_api_key(api_key):
            return JSONResponse(status_code=401, content={"detail": "Not authenticated."})

    return await call_next(request)


# Public API routes
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(seasons.router, prefix="/api", tags=["seasons"])
app.include_router(standings.router, prefix="/api", tags=["standings"])
app.include_router(races.router, prefix="/api", tags=["races"])
app.include_router(drivers.router, prefix="/api", tags=["drivers"])
app.include_router(teams.router, prefix="/api", tags=["teams"])
app.include_router(articles.router, prefix="/api", tags=["articles"])

# Admin routes
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])

# Serve frontend static files in production
frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(frontend_dist):
    from fastapi.responses import FileResponse

    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve static files or fall back to index.html for SPA routing."""
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
