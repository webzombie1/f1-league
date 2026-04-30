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

    # Each race_results row is resolved to an effective driver: the recorded
    # driver if not an AI substitute, otherwise the human who has them
    # assigned. Falls back to a name match on driver_name_raw when driver_id
    # is null. AI drivers themselves are filtered out of the standings list.
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
            COALESCE(SUM(r.points_awarded), 0) AS points,
            COALESCE(SUM(CASE WHEN r.position = 1 THEN 1 ELSE 0 END), 0) AS wins,
            COALESCE(SUM(CASE WHEN r.position <= 3 AND r.position IS NOT NULL THEN 1 ELSE 0 END), 0) AS podiums,
            COALESCE(SUM(CASE WHEN r.status IN ('dnf', 'retired', 'dsq') THEN 1 ELSE 0 END), 0) AS dnfs,
            COUNT(r.rr_id) AS races_entered
        FROM drivers d
        LEFT JOIN teams t ON d.team_id = t.id
        LEFT JOIN (
            SELECT
                rr.id AS rr_id,
                rr.race_id,
                rr.position,
                rr.status,
                rr.points_awarded,
                COALESCE(h.id, sd.id) AS effective_driver_id
            FROM race_results rr
            LEFT JOIN drivers sd ON sd.id = COALESCE(
                rr.driver_id,
                (SELECT id FROM drivers
                 WHERE season_id = ?
                   AND LOWER(TRIM(name)) = LOWER(TRIM(rr.driver_name_raw))
                 LIMIT 1)
            )
            LEFT JOIN drivers h ON h.id = (
                SELECT id FROM drivers
                WHERE ai_substitute_id = sd.id AND sd.is_ai = 1
                LIMIT 1
            )
        ) r ON r.effective_driver_id = d.id
        LEFT JOIN races ra ON r.race_id = ra.id AND ra.status = 'completed'
        WHERE d.season_id = ? AND d.is_active = 1 AND d.is_ai = 0
        GROUP BY d.id
        ORDER BY points DESC, wins DESC, podiums DESC
    """, (season_id, season_id))


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
