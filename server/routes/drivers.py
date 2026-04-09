"""Driver endpoints."""
from fastapi import APIRouter, Query
from server.db import execute

router = APIRouter()


@router.get("/drivers")
async def list_drivers(season_id: int = Query(None)):
    if not season_id:
        season = execute("SELECT id FROM seasons WHERE is_active = 1 LIMIT 1", fetch="one")
        if not season:
            return []
        season_id = season["id"]

    return execute("""
        SELECT d.*, t.name AS team_name, t.color AS team_color
        FROM drivers d
        LEFT JOIN teams t ON d.team_id = t.id
        WHERE d.season_id = ? AND d.is_active = 1
        ORDER BY t.sort_order, d.name
    """, (season_id,))


@router.get("/drivers/{driver_id}")
async def get_driver(driver_id: int):
    """Driver profile with race-by-race results."""
    driver = execute("""
        SELECT d.*, t.name AS team_name, t.color AS team_color
        FROM drivers d
        LEFT JOIN teams t ON d.team_id = t.id
        WHERE d.id = ?
    """, (driver_id,), fetch="one")

    if not driver:
        return {"detail": "Driver not found."}

    results = execute("""
        SELECT
            rr.*,
            r.round_number,
            r.track_name,
            r.country,
            r.date
        FROM race_results rr
        JOIN races r ON rr.race_id = r.id
        WHERE rr.driver_id = ? AND r.status = 'completed'
        ORDER BY r.round_number
    """, (driver_id,))

    driver["results"] = results

    # Aggregate stats
    driver["total_points"] = sum(r["points_awarded"] for r in results)
    driver["wins"] = sum(1 for r in results if r["position"] == 1)
    driver["podiums"] = sum(1 for r in results if r["position"] and r["position"] <= 3)
    driver["dnfs"] = sum(1 for r in results if r["status"] in ("dnf", "retired", "dsq"))
    best = [r["position"] for r in results if r["position"]]
    driver["best_finish"] = min(best) if best else None

    return driver
