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

    # Resolve the result's driver: use rr.driver_id if set, otherwise fall back
    # to a name match on rr.driver_name_raw within the race's season (covers
    # rows submitted before the driver record existed). Then, if that resolved
    # driver is an AI substitute, remap to the human who has them assigned —
    # the human's identity and team take over so the result reads as theirs.
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
        LEFT JOIN drivers d ON d.id = COALESCE(
            rr.driver_id,
            (SELECT id FROM drivers
             WHERE season_id = ? AND LOWER(name) = LOWER(rr.driver_name_raw)
             LIMIT 1)
        )
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
    """, (race["season_id"], race_id))

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
