"""Public season endpoints."""
from fastapi import APIRouter
from server.db import execute

router = APIRouter()


@router.get("/seasons")
async def list_seasons():
    return execute("SELECT * FROM seasons ORDER BY year DESC")


@router.get("/seasons/active")
async def get_active_season():
    season = execute("SELECT * FROM seasons WHERE is_active = 1 ORDER BY id DESC LIMIT 1", fetch="one")
    if not season:
        return {"detail": "No active season."}
    return season


@router.get("/highlights")
async def list_highlights(race_id: int):
    return execute(
        "SELECT * FROM highlights WHERE race_id = ? ORDER BY sort_order",
        (race_id,)
    )


@router.get("/off-weeks")
async def list_off_weeks(season_id: int):
    return execute(
        "SELECT * FROM off_weeks WHERE season_id = ? ORDER BY date",
        (season_id,)
    )
