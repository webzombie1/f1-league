"""Admin CRUD endpoints — all routes prefixed with /api/admin."""

import logging
from fastapi import APIRouter, Request
from server.db import execute, get_conn

logger = logging.getLogger(__name__)
router = APIRouter()

# Default F1 points: position -> points
DEFAULT_POINTS = {1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1, 0: 1}


# ─── Seasons ────────────────────────────────────────────────────────

@router.post("/seasons")
async def create_season(request: Request):
    body = await request.json()
    name = body.get("name", "")
    year = body.get("year", 2026)

    if not name:
        return {"error": "Season name is required."}

    # Deactivate all other seasons
    execute("UPDATE seasons SET is_active = 0", fetch="none")

    season_id = execute(
        "INSERT INTO seasons (name, year, is_active) VALUES (?, ?, 1)",
        (name, year), fetch="none"
    )

    # Seed default points config
    conn = get_conn()
    for position, points in DEFAULT_POINTS.items():
        conn.execute(
            "INSERT INTO points_config (season_id, position, points) VALUES (?, ?, ?)",
            (season_id, position, points)
        )
    conn.commit()
    conn.close()

    return {"id": season_id, "name": name, "year": year}


@router.put("/seasons/{season_id}")
async def update_season(season_id: int, request: Request):
    body = await request.json()
    name = body.get("name")
    is_active = body.get("is_active")

    if is_active:
        execute("UPDATE seasons SET is_active = 0", fetch="none")

    updates = []
    params = []
    if name is not None:
        updates.append("name = ?")
        params.append(name)
    if is_active is not None:
        updates.append("is_active = ?")
        params.append(1 if is_active else 0)

    if updates:
        params.append(season_id)
        execute(f"UPDATE seasons SET {', '.join(updates)} WHERE id = ?", tuple(params), fetch="none")

    return {"status": "updated"}


# ─── Teams ──────────────────────────────────────────────────────────

@router.post("/teams")
async def create_team(request: Request):
    body = await request.json()
    season_id = body.get("season_id")
    name = body.get("name", "")
    color = body.get("color", "#333333")
    sort_order = body.get("sort_order", 0)

    if not season_id or not name:
        return {"error": "season_id and name are required."}

    team_id = execute(
        "INSERT INTO teams (season_id, name, color, sort_order) VALUES (?, ?, ?, ?)",
        (season_id, name, color, sort_order), fetch="none"
    )
    return {"id": team_id, "name": name}


@router.put("/teams/{team_id}")
async def update_team(team_id: int, request: Request):
    body = await request.json()
    updates = []
    params = []

    for field in ("name", "color", "sort_order"):
        if field in body:
            updates.append(f"{field} = ?")
            params.append(body[field])

    if updates:
        params.append(team_id)
        execute(f"UPDATE teams SET {', '.join(updates)} WHERE id = ?", tuple(params), fetch="none")

    return {"status": "updated"}


@router.delete("/teams/{team_id}")
async def delete_team(team_id: int):
    execute("DELETE FROM teams WHERE id = ?", (team_id,), fetch="none")
    return {"status": "deleted"}


# ─── Drivers ────────────────────────────────────────────────────────

@router.post("/drivers")
async def create_driver(request: Request):
    body = await request.json()
    season_id = body.get("season_id")
    team_id = body.get("team_id")
    name = body.get("name", "")
    abbreviation = body.get("abbreviation", "")
    number = body.get("number")

    if not season_id or not name:
        return {"error": "season_id and name are required."}

    if not abbreviation and len(name) >= 3:
        abbreviation = name[:3].upper()

    driver_id = execute(
        "INSERT INTO drivers (season_id, team_id, name, abbreviation, number) VALUES (?, ?, ?, ?, ?)",
        (season_id, team_id, name, abbreviation, number), fetch="none"
    )
    return {"id": driver_id, "name": name}


@router.put("/drivers/{driver_id}")
async def update_driver(driver_id: int, request: Request):
    body = await request.json()
    updates = []
    params = []

    for field in ("name", "abbreviation", "number", "team_id", "is_active"):
        if field in body:
            updates.append(f"{field} = ?")
            params.append(body[field])

    if updates:
        params.append(driver_id)
        execute(f"UPDATE drivers SET {', '.join(updates)} WHERE id = ?", tuple(params), fetch="none")

    return {"status": "updated"}


@router.delete("/drivers/{driver_id}")
async def delete_driver(driver_id: int):
    execute("DELETE FROM drivers WHERE id = ?", (driver_id,), fetch="none")
    return {"status": "deleted"}


# ─── Races ──────────────────────────────────────────────────────────

@router.post("/races")
async def create_race(request: Request):
    body = await request.json()
    season_id = body.get("season_id")
    round_number = body.get("round_number")
    track_name = body.get("track_name", "")
    country = body.get("country", "")
    date = body.get("date", "")
    time = body.get("time", "")

    if not season_id or not round_number or not track_name:
        return {"error": "season_id, round_number, and track_name are required."}

    hero_image = body.get("hero_image", "")
    hero_headline = body.get("hero_headline", "")
    hero_subtitle = body.get("hero_subtitle", "")

    race_id = execute(
        "INSERT INTO races (season_id, round_number, track_name, country, date, time, hero_image, hero_headline, hero_subtitle) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (season_id, round_number, track_name, country, date, time, hero_image, hero_headline, hero_subtitle), fetch="none"
    )
    return {"id": race_id, "track_name": track_name}


@router.put("/races/{race_id}")
async def update_race(race_id: int, request: Request):
    body = await request.json()
    updates = []
    params = []

    for field in ("round_number", "track_name", "country", "date", "time", "status", "hero_image", "hero_headline", "hero_subtitle"):
        if field in body:
            updates.append(f"{field} = ?")
            params.append(body[field])

    if updates:
        params.append(race_id)
        execute(f"UPDATE races SET {', '.join(updates)} WHERE id = ?", tuple(params), fetch="none")

    return {"status": "updated"}


@router.delete("/races/{race_id}")
async def delete_race(race_id: int):
    execute("DELETE FROM races WHERE id = ?", (race_id,), fetch="none")
    return {"status": "deleted"}


# ─── Race Results ───────────────────────────────────────────────────

@router.post("/races/{race_id}/results")
async def submit_results(race_id: int, request: Request):
    """Submit full race results (from capture tool or manual entry)."""
    body = await request.json()
    results_data = body.get("results", [])

    if not results_data:
        return {"error": "No results provided."}

    # Verify race exists
    race = execute("SELECT * FROM races WHERE id = ?", (race_id,), fetch="one")
    if not race:
        return {"error": "Race not found."}

    # Get points config for this season
    points_config = {}
    rows = execute("SELECT position, points FROM points_config WHERE season_id = ?", (race["season_id"],))
    for row in rows:
        points_config[row["position"]] = row["points"]

    # Find the fastest lap holder
    fastest_lap_driver = None
    fastest_lap_time = None
    for r in results_data:
        if r.get("best_lap_time_ms") and r.get("status", "finished") == "finished":
            if fastest_lap_time is None or r["best_lap_time_ms"] < fastest_lap_time:
                fastest_lap_time = r["best_lap_time_ms"]
                fastest_lap_driver = r.get("driver_name", "")

    conn = get_conn()
    unmatched = []

    for r in results_data:
        driver_name = r.get("driver_name", "")
        position = r.get("position")
        status = r.get("status", "finished")

        # Try to match driver by name (case-insensitive)
        driver = execute(
            "SELECT id FROM drivers WHERE season_id = ? AND LOWER(name) = LOWER(?)",
            (race["season_id"], driver_name), fetch="one"
        )
        driver_id = driver["id"] if driver else None

        if not driver_id:
            unmatched.append(driver_name)

        # Calculate points
        points = 0
        if status == "finished" and position:
            points = points_config.get(position, 0)

        # Fastest lap bonus (only if finished in top 10)
        is_fastest = (driver_name == fastest_lap_driver)
        if is_fastest and position and position <= 10:
            points += points_config.get(0, 0)

        result_id = conn.execute(
            """INSERT OR REPLACE INTO race_results
            (race_id, driver_id, driver_name_raw, position, grid_position,
             laps_completed, status, status_reason, best_lap_time_ms,
             total_time_s, penalties_time_s, num_penalties, num_pit_stops,
             points_awarded, fastest_lap, gap_to_leader)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (race_id, driver_id, driver_name, position, r.get("grid_position"),
             r.get("laps_completed", 0), status, r.get("status_reason", ""),
             r.get("best_lap_time_ms"), r.get("total_time_s"),
             r.get("penalties_time_s", 0), r.get("num_penalties", 0),
             r.get("num_pit_stops", 0), points, 1 if is_fastest else 0,
             r.get("gap_to_leader", ""))
        ).lastrowid

        # Insert tyre stints
        for stint in r.get("tyre_stints", []):
            conn.execute(
                "INSERT INTO tyre_stints (result_id, stint_number, compound, laps) VALUES (?, ?, ?, ?)",
                (result_id, stint.get("stint_number", 0), stint.get("compound", ""), stint.get("laps", 0))
            )

    # Mark race as completed
    conn.execute("UPDATE races SET status = 'completed' WHERE id = ?", (race_id,))
    conn.commit()
    conn.close()

    response = {"status": "ok", "results_count": len(results_data)}
    if unmatched:
        response["unmatched_drivers"] = unmatched
        response["warning"] = f"{len(unmatched)} driver(s) could not be matched to registered drivers."

    logger.info("Race %d results submitted: %d results, %d unmatched", race_id, len(results_data), len(unmatched))
    return response


@router.put("/results/{result_id}")
async def update_result(result_id: int, request: Request):
    """Edit a single race result (override points, fix position, etc.)."""
    body = await request.json()
    updates = []
    params = []

    for field in ("position", "grid_position", "laps_completed", "status", "status_reason",
                  "points_awarded", "fastest_lap", "gap_to_leader", "driver_id",
                  "penalties_time_s", "num_penalties"):
        if field in body:
            updates.append(f"{field} = ?")
            params.append(body[field])

    if updates:
        params.append(result_id)
        execute(f"UPDATE race_results SET {', '.join(updates)} WHERE id = ?", tuple(params), fetch="none")

    return {"status": "updated"}


@router.delete("/races/{race_id}/results")
async def clear_results(race_id: int):
    """Clear all results for a race (for re-capture)."""
    # Delete tyre stints first (cascade doesn't work with execute helper)
    conn = get_conn()
    conn.execute("DELETE FROM tyre_stints WHERE result_id IN (SELECT id FROM race_results WHERE race_id = ?)", (race_id,))
    conn.execute("DELETE FROM race_results WHERE race_id = ?", (race_id,))
    conn.execute("UPDATE races SET status = 'upcoming' WHERE id = ?", (race_id,))
    conn.commit()
    conn.close()
    return {"status": "cleared"}


# ─── Points Config ──────────────────────────────────────────────────

@router.get("/points-config")
async def get_points_config(season_id: int):
    return execute(
        "SELECT * FROM points_config WHERE season_id = ? ORDER BY position",
        (season_id,)
    )


@router.put("/points-config")
async def update_points_config(request: Request):
    """Update points mapping for a season. Body: {season_id, points: {position: points}}."""
    body = await request.json()
    season_id = body.get("season_id")
    points_map = body.get("points", {})

    if not season_id or not points_map:
        return {"error": "season_id and points are required."}

    conn = get_conn()
    conn.execute("DELETE FROM points_config WHERE season_id = ?", (season_id,))
    for position, points in points_map.items():
        conn.execute(
            "INSERT INTO points_config (season_id, position, points) VALUES (?, ?, ?)",
            (season_id, int(position), int(points))
        )
    conn.commit()
    conn.close()

    return {"status": "updated"}
