"""Team endpoints."""
from fastapi import APIRouter, Query
from server.db import execute

router = APIRouter()


@router.get("/teams")
async def list_teams(season_id: int = Query(None)):
    if not season_id:
        season = execute("SELECT id FROM seasons WHERE is_active = 1 LIMIT 1", fetch="one")
        if not season:
            return []
        season_id = season["id"]

    teams = execute("""
        SELECT * FROM teams
        WHERE season_id = ?
        ORDER BY sort_order, name
    """, (season_id,))

    # Attach drivers to each team
    for team in teams:
        team["drivers"] = execute("""
            SELECT id, name, abbreviation, number
            FROM drivers
            WHERE team_id = ? AND is_active = 1
            ORDER BY number
        """, (team["id"],))

    return teams


@router.get("/teams/{team_id}")
async def get_team(team_id: int):
    """Team detail with drivers and stats."""
    team = execute("SELECT * FROM teams WHERE id = ?", (team_id,), fetch="one")
    if not team:
        return {"detail": "Team not found."}

    team["drivers"] = execute("""
        SELECT id, name, abbreviation, number
        FROM drivers
        WHERE team_id = ? AND is_active = 1
        ORDER BY number
    """, (team_id,))

    # Team stats from race results
    stats = execute("""
        SELECT
            COALESCE(SUM(rr.points_awarded), 0) AS points,
            COALESCE(SUM(CASE WHEN rr.position = 1 THEN 1 ELSE 0 END), 0) AS wins,
            COALESCE(SUM(CASE WHEN rr.position <= 3 AND rr.position IS NOT NULL THEN 1 ELSE 0 END), 0) AS podiums
        FROM race_results rr
        JOIN drivers d ON rr.driver_id = d.id
        JOIN races r ON rr.race_id = r.id AND r.status = 'completed'
        WHERE d.team_id = ? AND d.is_active = 1
    """, (team_id,), fetch="one")

    team.update(stats or {"points": 0, "wins": 0, "podiums": 0})
    return team
