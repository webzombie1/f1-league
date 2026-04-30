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

    # If the recorded driver is an AI substitute, remap to the human driver
    # who has them assigned (h.ai_substitute_id = d.id). The human's identity
    # and team take over so the result reads as the human's.
    results = execute("""
        SELECT
            rr.*,
            COALESCE(h.name, d.name) AS driver_name,
            COALESCE(h.abbreviation, d.abbreviation) AS driver_abbreviation,
            COALESCE(h.number, d.number) AS driver_number,
            COALESCE(t_h.name, t_d.name) AS team_name,
            COALESCE(t_h.color, t_d.color) AS team_color,
            COALESCE(t_h.car_image, t_d.car_image) AS team_car_image,
            COALESCE(t_h.logo_url, t_d.logo_url) AS team_logo,
            COALESCE(h.photo_url, d.photo_url) AS driver_photo
        FROM race_results rr
        LEFT JOIN drivers d ON rr.driver_id = d.id
        LEFT JOIN drivers h ON h.id = (
            SELECT id FROM drivers
            WHERE ai_substitute_id = d.id AND d.is_ai = 1
            LIMIT 1
        )
        LEFT JOIN teams t_d ON d.team_id = t_d.id
        LEFT JOIN teams t_h ON h.team_id = t_h.id
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
