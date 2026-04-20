"""Admin CRUD endpoints — all routes prefixed with /api/admin."""

import json
import logging
import os
import shutil
from fastapi import APIRouter, Request, UploadFile, File
from server.db import execute, get_conn
from server.config import GEMINI_API_KEY

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

    for field in ("name", "season_start", "race_time"):
        if field in body:
            updates.append(f"{field} = ?")
            params.append(body[field])
    if "race_day" in body:
        updates.append("race_day = ?")
        params.append(int(body["race_day"]))
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
    car_image = body.get("car_image", "")
    logo_url = body.get("logo_url", "")
    sort_order = body.get("sort_order", 0)

    if not season_id or not name:
        return {"error": "season_id and name are required."}

    team_id = execute(
        "INSERT INTO teams (season_id, name, color, car_image, logo_url, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
        (season_id, name, color, car_image, logo_url, sort_order), fetch="none"
    )
    return {"id": team_id, "name": name}


@router.put("/teams/{team_id}")
async def update_team(team_id: int, request: Request):
    body = await request.json()
    updates = []
    params = []

    for field in ("name", "color", "car_image", "logo_url", "sort_order"):
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

    photo_url = body.get("photo_url", "")
    ea_tag = body.get("ea_tag", "")
    platform = body.get("platform", "")
    discord_name = body.get("discord_name", "")
    discord_url = body.get("discord_url", "")

    driver_id = execute(
        "INSERT INTO drivers (season_id, team_id, name, abbreviation, number, photo_url, ea_tag, platform, discord_name, discord_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (season_id, team_id, name, abbreviation, number, photo_url, ea_tag, platform, discord_name, discord_url), fetch="none"
    )
    return {"id": driver_id, "name": name}


@router.put("/drivers/{driver_id}")
async def update_driver(driver_id: int, request: Request):
    body = await request.json()
    updates = []
    params = []

    for field in ("name", "abbreviation", "number", "team_id", "is_active", "photo_url", "photo_standing", "ea_tag", "platform", "discord_name", "discord_url"):
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


@router.post("/drivers/{driver_id}/photo")
async def upload_driver_photo(driver_id: int, file: UploadFile = File(...), request: Request = None):
    """Upload a driver photo. Use ?type=standing for full-body, default is thumbnail."""
    photo_type = "thumbnail"
    if request and "standing" in (request.query_params.get("type", "")):
        photo_type = "standing"

    upload_dir = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "public", "drivers")
    if os.path.isdir("/data"):
        upload_dir = "/data/drivers"
    os.makedirs(upload_dir, exist_ok=True)

    ext = os.path.splitext(file.filename)[1] or ".png"
    filename = f"driver_{driver_id}_{photo_type}{ext}"
    filepath = os.path.join(upload_dir, filename)

    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)

    photo_url = f"/drivers/{filename}"
    field = "photo_standing" if photo_type == "standing" else "photo_url"
    execute(f"UPDATE drivers SET {field} = ? WHERE id = ?", (photo_url, driver_id), fetch="none")

    return {"status": "uploaded", "photo_url": photo_url, "type": photo_type}


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
    track_image = body.get("track_image", "")

    try:
        race_id = execute(
            "INSERT INTO races (season_id, round_number, track_name, country, date, time, hero_image, hero_headline, hero_subtitle, track_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (season_id, round_number, track_name, country, date, time, hero_image, hero_headline, hero_subtitle, track_image), fetch="none"
        )
        return {"id": race_id, "track_name": track_name}
    except Exception as e:
        logger.error("Failed to create race: %s", e)
        return {"error": f"Failed to create race: {str(e)}"}


@router.put("/races/{race_id}")
async def update_race(race_id: int, request: Request):
    body = await request.json()
    updates = []
    params = []

    for field in ("round_number", "track_name", "country", "date", "time", "status", "hero_image", "hero_headline", "hero_subtitle", "track_image"):
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


@router.put("/races/bulk-update")
async def bulk_update_races(request: Request):
    """Update multiple races at once (for reorder/date recalculation)."""
    body = await request.json()
    updates = body.get("updates", [])

    conn = get_conn()
    for u in updates:
        fields = []
        params = []
        for field in ("round_number", "date", "time", "status"):
            if field in u:
                fields.append(f"{field} = ?")
                params.append(u[field])
        if fields:
            params.append(u["id"])
            conn.execute(f"UPDATE races SET {', '.join(fields)} WHERE id = ?", tuple(params))
    conn.commit()
    conn.close()
    return {"status": "updated", "count": len(updates)}


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
             laps_completed, status, status_reason, best_lap_time_ms, quali_time_ms,
             total_time_s, penalties_time_s, num_penalties, num_pit_stops,
             points_awarded, fastest_lap, gap_to_leader)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (race_id, driver_id, driver_name, position, r.get("grid_position"),
             r.get("laps_completed", 0), status, r.get("status_reason", ""),
             r.get("best_lap_time_ms"), r.get("quali_time_ms"),
             r.get("total_time_s"),
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
                  "penalties_time_s", "num_penalties", "best_lap_time_ms", "quali_time_ms"):
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


# ─── Off Weeks ──────────────────────────────────────────────────────

@router.get("/off-weeks")
async def list_off_weeks(season_id: int):
    """List off weeks — also available without auth for schedule display."""
    return execute(
        "SELECT * FROM off_weeks WHERE season_id = ? ORDER BY date",
        (season_id,)
    )


@router.post("/off-weeks")
async def create_off_week(request: Request):
    body = await request.json()
    season_id = body.get("season_id")
    date = body.get("date", "")
    reason = body.get("reason", "")

    if not season_id or not date:
        return {"error": "season_id and date are required."}

    off_id = execute(
        "INSERT INTO off_weeks (season_id, date, reason) VALUES (?, ?, ?)",
        (season_id, date, reason), fetch="none"
    )
    return {"id": off_id, "date": date, "reason": reason}


@router.delete("/off-weeks/{off_id}")
async def delete_off_week(off_id: int):
    execute("DELETE FROM off_weeks WHERE id = ?", (off_id,), fetch="none")
    return {"status": "deleted"}


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


# ─── Articles ───────────────────────────────────────────────────────

@router.get("/articles")
async def list_admin_articles():
    return execute("SELECT a.*, r.track_name FROM articles a LEFT JOIN races r ON a.race_id = r.id ORDER BY a.created_at DESC")


@router.post("/articles")
async def create_article(request: Request):
    body = await request.json()
    season_id = body.get("season_id")
    race_id = body.get("race_id")
    headline = body.get("headline", "")
    subtitle = body.get("subtitle", "")
    article_body = body.get("body", "")
    hero_image = body.get("hero_image", "")

    if not season_id or not headline:
        return {"error": "season_id and headline are required."}

    article_id = execute(
        "INSERT INTO articles (season_id, race_id, headline, subtitle, body, hero_image) VALUES (?, ?, ?, ?, ?, ?)",
        (season_id, race_id, headline, subtitle, article_body, hero_image), fetch="none"
    )
    return {"id": article_id, "headline": headline}


@router.put("/articles/{article_id}")
async def update_article(article_id: int, request: Request):
    body = await request.json()
    updates = []
    params = []

    for field in ("headline", "subtitle", "body", "hero_image", "race_id", "published"):
        if field in body:
            updates.append(f"{field} = ?")
            params.append(body[field])

    if updates:
        params.append(article_id)
        execute(f"UPDATE articles SET {', '.join(updates)} WHERE id = ?", tuple(params), fetch="none")

    return {"status": "updated"}


@router.delete("/articles/{article_id}")
async def delete_article(article_id: int):
    execute("DELETE FROM articles WHERE id = ?", (article_id,), fetch="none")
    return {"status": "deleted"}


@router.post("/articles/generate")
async def generate_article(request: Request):
    """Generate a comedic race recap article using Gemini."""
    body = await request.json()
    race_id = body.get("race_id")

    if not race_id:
        return {"error": "race_id is required."}

    if not GEMINI_API_KEY:
        return {"error": "GEMINI_API_KEY not configured."}

    # Get race + results
    race = execute("SELECT * FROM races WHERE id = ?", (race_id,), fetch="one")
    if not race:
        return {"error": "Race not found."}

    results = execute("""
        SELECT rr.*, d.name AS driver_name, t.name AS team_name
        FROM race_results rr
        LEFT JOIN drivers d ON rr.driver_id = d.id
        LEFT JOIN teams t ON d.team_id = t.id
        WHERE rr.race_id = ?
        ORDER BY CASE WHEN rr.position IS NOT NULL THEN 0 ELSE 1 END, rr.position
    """, (race_id,))

    if not results:
        return {"error": "No results for this race."}

    # Build results summary for the prompt
    results_text = ""
    for r in results:
        name = r["driver_name"] or r["driver_name_raw"] or "Unknown"
        team = r["team_name"] or "Unknown"
        if r["status"] == "finished":
            results_text += f"P{r['position']}: {name} ({team}) - Gap: {r['gap_to_leader'] or 'Winner'}\n"
        else:
            results_text += f"{r['status'].upper()}: {name} ({team}) - {r['status_reason'] or 'Retired'}\n"

    prompt = f"""You are a comedic motorsport journalist writing for the GDR League, an F1 25 esports racing league.
Write a short, entertaining race recap article (about 300 words, 5-6 paragraphs) for the following race.

Race: Round {race['round_number']} - {race['track_name']}, {race['country']}

Results:
{results_text}

Guidelines:
- Write in a professional motorsport journalism style but with dry wit and humor
- Include 2-3 fake driver quotes (in quotation marks) that are funny but plausible
- The winner should get the most coverage
- Any DNFs or incidents should be dramatized for comedic effect
- Keep it grounded in what actually happened — don't invent events that didn't occur
- Use paragraph breaks between sections (output as plain text with blank lines between paragraphs)

Return your response as JSON with these fields:
- "headline": A punchy headline (e.g., "Hoecker Takes P1 in Australia")
- "subtitle": A one-sentence subheadline summarizing the drama
- "body": The full article text with paragraph breaks as \\n\\n"""

    try:
        from google import genai
        client = genai.Client(api_key=GEMINI_API_KEY)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )

        # Parse the JSON response
        text = response.text.strip()
        # Strip markdown code fences if present
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            if text.endswith("```"):
                text = text[:-3]
            elif "```" in text:
                text = text[:text.rfind("```")]
            text = text.strip()

        article_data = json.loads(text)

        return {
            "headline": article_data.get("headline", ""),
            "subtitle": article_data.get("subtitle", ""),
            "body": article_data.get("body", ""),
        }

    except Exception as e:
        logger.error("Article generation failed: %s", e, exc_info=True)
        return {"error": f"Generation failed: {str(e)}"}
