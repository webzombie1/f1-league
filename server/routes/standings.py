"""Driver and constructor standings."""
from fastapi import APIRouter, Query
from server.db import execute

router = APIRouter()


@router.get("/standings/drivers")
async def driver_standings(season_id: int = Query(None)):
    """Driver standings with points, wins, podiums, DNFs."""
    if not season_id:
        season = execute("SELECT id FROM seasons WHERE is_active = 1 LIMIT 1", fetch="one")
        if not season:
            return []
        season_id = season["id"]

    return execute("""
        SELECT
            d.id,
            d.name,
            d.abbreviation,
            d.number,
            d.photo_url,
            d.photo_standing,
            t.name AS team_name,
            t.color AS team_color,
            t.logo_url AS team_logo,
            COALESCE(SUM(rr.points_awarded), 0) AS points,
            COALESCE(SUM(CASE WHEN rr.position = 1 THEN 1 ELSE 0 END), 0) AS wins,
            COALESCE(SUM(CASE WHEN rr.position <= 3 AND rr.position IS NOT NULL THEN 1 ELSE 0 END), 0) AS podiums,
            COALESCE(SUM(CASE WHEN rr.status IN ('dnf', 'retired', 'dsq') THEN 1 ELSE 0 END), 0) AS dnfs,
            COUNT(rr.id) AS races_entered
        FROM drivers d
        LEFT JOIN teams t ON d.team_id = t.id
        LEFT JOIN race_results rr ON rr.driver_id = d.id
        LEFT JOIN races r ON rr.race_id = r.id AND r.status = 'completed'
        WHERE d.season_id = ? AND d.is_active = 1
        GROUP BY d.id
        ORDER BY points DESC, wins DESC, podiums DESC
    """, (season_id,))


@router.get("/standings/constructors")
async def constructor_standings(season_id: int = Query(None)):
    """Constructor standings aggregated from drivers."""
    if not season_id:
        season = execute("SELECT id FROM seasons WHERE is_active = 1 LIMIT 1", fetch="one")
        if not season:
            return []
        season_id = season["id"]

    return execute("""
        SELECT
            t.id,
            t.name,
            t.color,
            t.logo_url,
            COALESCE(SUM(rr.points_awarded), 0) AS points,
            COALESCE(SUM(CASE WHEN rr.position = 1 THEN 1 ELSE 0 END), 0) AS wins,
            COALESCE(SUM(CASE WHEN rr.position <= 3 AND rr.position IS NOT NULL THEN 1 ELSE 0 END), 0) AS podiums
        FROM teams t
        LEFT JOIN drivers d ON d.team_id = t.id AND d.is_active = 1
        LEFT JOIN race_results rr ON rr.driver_id = d.id
        LEFT JOIN races r ON rr.race_id = r.id AND r.status = 'completed'
        WHERE t.season_id = ?
        GROUP BY t.id
        ORDER BY points DESC, wins DESC
    """, (season_id,))
