"""Race schedule and results."""
from fastapi import APIRouter, Query
from server.db import execute

router = APIRouter()


@router.get("/races")
async def list_races(season_id: int = Query(None)):
    if not season_id:
        season = execute("SELECT id FROM seasons WHERE is_active = 1 LIMIT 1", fetch="one")
        if not season:
            return []
        season_id = season["id"]

    return execute("""
        SELECT * FROM races
        WHERE season_id = ?
        ORDER BY round_number
    """, (season_id,))


@router.get("/races/{race_id}")
async def get_race(race_id: int):
    """Get race detail with full results and tyre stints."""
    race = execute("SELECT * FROM races WHERE id = ?", (race_id,), fetch="one")
    if not race:
        return {"detail": "Race not found."}

    results = execute("""
        SELECT
            rr.*,
            d.name AS driver_name,
            d.abbreviation AS driver_abbreviation,
            d.number AS driver_number,
            t.name AS team_name,
            t.color AS team_color
        FROM race_results rr
        LEFT JOIN drivers d ON rr.driver_id = d.id
        LEFT JOIN teams t ON d.team_id = t.id
        WHERE rr.race_id = ?
        ORDER BY
            CASE WHEN rr.position IS NOT NULL THEN 0 ELSE 1 END,
            rr.position
    """, (race_id,))

    # Attach tyre stints to each result
    for result in results:
        result["tyre_stints"] = execute("""
            SELECT stint_number, compound, laps
            FROM tyre_stints
            WHERE result_id = ?
            ORDER BY stint_number
        """, (result["id"],))

    race["results"] = results
    return race
