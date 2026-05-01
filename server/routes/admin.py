"""Admin CRUD endpoints — all routes prefixed with /api/admin."""

import json
import logging
import os
import shutil
import time
import urllib.request
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
    ai_substitute_id = body.get("ai_substitute_id")

    driver_id = execute(
        "INSERT INTO drivers (season_id, team_id, name, abbreviation, number, photo_url, ea_tag, platform, discord_name, discord_url, ai_substitute_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (season_id, team_id, name, abbreviation, number, photo_url, ea_tag, platform, discord_name, discord_url, ai_substitute_id), fetch="none"
    )
    return {"id": driver_id, "name": name}


@router.put("/drivers/{driver_id}")
async def update_driver(driver_id: int, request: Request):
    body = await request.json()
    updates = []
    params = []

    for field in ("name", "abbreviation", "number", "team_id", "is_active", "photo_url", "photo_standing", "ea_tag", "platform", "discord_name", "discord_url", "ai_substitute_id", "is_ai", "likeness_notes"):
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


# ─── Driver Reference Photos (extra likeness inputs for image gen) ──

DRIVER_REFS_DIR = "/data/driver_refs" if os.path.isdir("/data") else os.path.join(
    os.path.dirname(__file__), "..", "..", "frontend", "public", "driver_refs"
)


@router.get("/drivers/{driver_id}/reference-photos")
async def list_driver_reference_photos(driver_id: int):
    return execute(
        "SELECT * FROM driver_reference_photos WHERE driver_id = ? ORDER BY sort_order, id",
        (driver_id,)
    )


@router.post("/drivers/{driver_id}/reference-photos")
async def upload_driver_reference_photo(
    driver_id: int,
    file: UploadFile = File(...),
):
    driver = execute("SELECT id FROM drivers WHERE id = ?", (driver_id,), fetch="one")
    if not driver:
        return {"error": "Driver not found."}
    os.makedirs(DRIVER_REFS_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename)[1] or ".png"
    filename = f"driver_{driver_id}_{int(time.time() * 1000)}{ext}"
    filepath = os.path.join(DRIVER_REFS_DIR, filename)
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)
    image_path = f"/driver_refs/{filename}"
    ref_id = execute(
        "INSERT INTO driver_reference_photos (driver_id, image_path) VALUES (?, ?)",
        (driver_id, image_path), fetch="none"
    )
    return {"id": ref_id, "image_path": image_path}


@router.delete("/drivers/reference-photos/{ref_id}")
async def delete_driver_reference_photo(ref_id: int):
    row = execute("SELECT image_path FROM driver_reference_photos WHERE id = ?", (ref_id,), fetch="one")
    execute("DELETE FROM driver_reference_photos WHERE id = ?", (ref_id,), fetch="none")
    if row and row.get("image_path"):
        candidate = os.path.join("/data", row["image_path"].lstrip("/")) if os.path.isdir("/data") else None
        if candidate and os.path.isfile(candidate):
            try:
                os.remove(candidate)
            except OSError:
                pass
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


@router.put("/races/bulk-update")
async def bulk_update_races(request: Request):
    """Update multiple races at once (for reorder/date recalculation)."""
    body = await request.json()
    updates = body.get("updates", [])

    try:
        conn = get_conn()
        # Defer unique constraints so swapping round numbers doesn't fail mid-transaction
        conn.execute("PRAGMA defer_foreign_keys = ON")
        # Temporarily set all round numbers to negative to avoid unique conflicts
        race_ids = [u["id"] for u in updates if "round_number" in u]
        if race_ids:
            placeholders = ",".join("?" * len(race_ids))
            conn.execute(f"UPDATE races SET round_number = -round_number WHERE id IN ({placeholders})", race_ids)
        # Now apply the actual updates
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
    except Exception as e:
        logger.error("Bulk update failed: %s", e, exc_info=True)
        return {"error": f"Bulk update failed: {str(e)}"}


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

    # Build AI substitute reverse map: {ai_driver_id: human_driver}
    sub_rows = execute(
        "SELECT id, name, ai_substitute_id FROM drivers WHERE season_id = ? AND ai_substitute_id IS NOT NULL",
        (race["season_id"],)
    )
    # Map: ai_driver_id -> {human_id, human_name}
    ai_to_human = {}
    for s in sub_rows:
        if s["ai_substitute_id"]:
            ai_to_human[s["ai_substitute_id"]] = {"id": s["id"], "name": s["name"]}

    # Also build reverse by name for AI drivers that are subs
    ai_name_to_human = {}
    for ai_id, human in ai_to_human.items():
        ai_driver = execute("SELECT name FROM drivers WHERE id = ?", (ai_id,), fetch="one")
        if ai_driver:
            ai_name_to_human[ai_driver["name"].lower()] = human

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

        # Check if this driver is an AI substitute — remap to human driver
        if driver_id and driver_id in ai_to_human:
            human = ai_to_human[driver_id]
            driver_id = human["id"]
            driver_name = human["name"]
        elif driver_name.lower() in ai_name_to_human:
            human = ai_name_to_human[driver_name.lower()]
            driver_id = human["id"]
            driver_name = human["name"]

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
                  "penalties_time_s", "num_penalties", "best_lap_time_ms", "quali_time_ms",
                  "total_time_s"):
        if field in body:
            updates.append(f"{field} = ?")
            params.append(body[field])

    if updates:
        params.append(result_id)
        execute(f"UPDATE race_results SET {', '.join(updates)} WHERE id = ?", tuple(params), fetch="none")

    return {"status": "updated"}


@router.delete("/results/{result_id}")
async def delete_result(result_id: int):
    """Delete a single race result row (and its tyre stints)."""
    conn = get_conn()
    conn.execute("DELETE FROM tyre_stints WHERE result_id = ?", (result_id,))
    conn.execute("DELETE FROM race_results WHERE id = ?", (result_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}


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


# ─── Celebration Templates ──────────────────────────────────────────

CELEBRATION_DIR = "/data/celebration_templates" if os.path.isdir("/data") else os.path.join(
    os.path.dirname(__file__), "..", "..", "frontend", "public", "celebration_templates"
)


@router.get("/celebration-templates")
async def list_celebration_templates():
    return execute(
        "SELECT * FROM celebration_templates ORDER BY sort_order, id"
    )


@router.post("/celebration-templates")
async def create_celebration_template(request: Request):
    body = await request.json()
    name = (body.get("name") or "").strip()
    prompt = (body.get("prompt") or "").strip()
    if not name or not prompt:
        return {"error": "name and prompt are required."}
    template_id = execute(
        """INSERT INTO celebration_templates (name, prompt, country_tag, podium_tag, is_active, sort_order)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (name, prompt,
         (body.get("country_tag") or "").strip(),
         (body.get("podium_tag") or "").strip(),
         1 if body.get("is_active", True) else 0,
         int(body.get("sort_order") or 0)),
        fetch="none"
    )
    return {"id": template_id}


@router.put("/celebration-templates/{template_id}")
async def update_celebration_template(template_id: int, request: Request):
    body = await request.json()
    updates = []
    params = []
    for field in ("name", "prompt", "country_tag", "podium_tag", "is_active", "sort_order"):
        if field in body:
            updates.append(f"{field} = ?")
            params.append(body[field])
    if updates:
        params.append(template_id)
        execute(
            f"UPDATE celebration_templates SET {', '.join(updates)} WHERE id = ?",
            tuple(params), fetch="none"
        )
    return {"status": "updated"}


@router.delete("/celebration-templates/{template_id}")
async def delete_celebration_template(template_id: int):
    row = execute("SELECT image_path FROM celebration_templates WHERE id = ?", (template_id,), fetch="one")
    execute("DELETE FROM celebration_templates WHERE id = ?", (template_id,), fetch="none")
    # Best-effort cleanup of the uploaded reference image
    if row and row.get("image_path"):
        path_on_disk = row["image_path"].lstrip("/")
        candidate = os.path.join("/data", path_on_disk) if os.path.isdir("/data") else None
        if candidate and os.path.isfile(candidate):
            try:
                os.remove(candidate)
            except OSError:
                pass
    return {"status": "deleted"}


@router.post("/celebration-templates/{template_id}/image")
async def upload_celebration_template_image(template_id: int, file: UploadFile = File(...)):
    template = execute("SELECT id FROM celebration_templates WHERE id = ?", (template_id,), fetch="one")
    if not template:
        return {"error": "Template not found."}
    os.makedirs(CELEBRATION_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename)[1] or ".png"
    filename = f"template_{template_id}{ext}"
    filepath = os.path.join(CELEBRATION_DIR, filename)
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)
    image_path = f"/celebration_templates/{filename}"
    execute(
        "UPDATE celebration_templates SET image_path = ? WHERE id = ?",
        (image_path, template_id), fetch="none"
    )
    return {"status": "uploaded", "image_path": image_path}


# ─── Celebration Hero Generation ────────────────────────────────────

HEROES_DIR = "/data/celebration_heroes" if os.path.isdir("/data") else os.path.join(
    os.path.dirname(__file__), "..", "..", "frontend", "public", "celebration_heroes"
)


# Distinctive visual cues for the F1 circuits we run. Gemini Pro knows most of
# these already, but spelling out the iconic feature dramatically improves how
# recognizable the rendered venue is. Keyed loosely by track name substring.
CIRCUIT_NOTES = {
    "monza": "Monza's iconic podium that bridges over the start/finish straight (cars passing underneath), surrounded by the Royal Park's classic Italian forest and tifosi in red.",
    "monaco": "Monaco's harbour backdrop crammed with super-yachts, the Hotel de Paris and Casino square architecture, narrow Armco-lined streets behind.",
    "silverstone": "Silverstone's modern Wing pit complex, British Racing Green grandstands, the Northamptonshire countryside.",
    "spa": "Spa-Francorchamps' Ardennes forest, dramatic elevation changes, low grey clouds typical of the venue.",
    "suzuka": "Suzuka's figure-eight layout cues, ferris wheel of the adjacent amusement park, Japanese signage.",
    "monaco grand prix": "Monaco harbour with super-yachts and the Hotel de Paris.",
    "australia": "Albert Park lake and Melbourne city skyline behind the trees.",
    "albert park": "Albert Park lake and Melbourne city skyline behind the trees.",
    "shanghai": "the Shanghai International Circuit's signature tower-like pit gantry and modern Chinese architecture.",
    "miami": "Miami's pastel grandstands, palm trees, and Hard Rock Stadium silhouette.",
    "canada": "the Île Notre-Dame setting with Montreal's St. Lawrence River and downtown skyline.",
    "barcelona": "Barcelona-Catalunya's distinctive grandstand structures and dry Catalan hills.",
    "spain": "Barcelona-Catalunya's distinctive grandstand structures and dry Catalan hills.",
    "austria": "the Red Bull Ring's Styrian alpine backdrop and Red Bull branded grandstands.",
    "great britain": "Silverstone's modern Wing pit complex and British countryside.",
    "belgium": "Spa's Ardennes forest and dramatic elevation.",
    "hungary": "the Hungaroring's basin layout with Budapest's wooded hills behind.",
    "netherlands": "Zandvoort's banked corners, dunes, and a sea of orange-clad fans.",
    "italy": "Monza's tree-lined Royal Park, classic Italian architecture, and the iconic over-track podium with the tifosi flooding the straight below.",
    "azerbaijan": "Baku's old-town walls and the Flame Towers in the distance.",
    "singapore": "Marina Bay's night-race lighting, modern skyline, and the floating platform.",
    "united states": "Circuit of the Americas' tower observation deck and Texas hills.",
    "mexico": "the Foro Sol stadium section packed with a roaring Mexican crowd.",
    "brazil": "Interlagos' São Paulo skyline and the steep main-straight elevation.",
    "las vegas": "the Las Vegas Strip casinos lit up at night.",
    "qatar": "the Lusail Circuit's stark desert backdrop and modern grandstand architecture.",
    "abu dhabi": "the Yas Marina hotel arching over the track at sunset, glowing in colour.",
    "bahrain": "the desert backdrop and floodlit Bahrain pit complex.",
    "saudi arabia": "the Jeddah corniche's coastline and modern street-circuit walls.",
}


def _circuit_note(race: dict) -> str:
    """Return a short visual cue string for the race's circuit, or empty."""
    haystack = " ".join([
        (race.get("track_name") or ""),
        (race.get("country") or ""),
    ]).lower()
    for needle, note in CIRCUIT_NOTES.items():
        if needle in haystack:
            return note
    return ""


def _load_image_bytes(path_or_url: str) -> bytes | None:
    """Resolve a stored image reference (URL or /-rooted path) and return bytes."""
    if not path_or_url:
        return None
    if path_or_url.startswith(("http://", "https://")):
        try:
            with urllib.request.urlopen(path_or_url, timeout=20) as resp:
                return resp.read()
        except Exception as e:
            logger.error("Failed to fetch external image %s: %s", path_or_url, e)
            return None
    relative = path_or_url.lstrip("/")
    candidates = []
    if os.path.isdir("/data"):
        candidates.append(os.path.join("/data", relative))
    base = os.path.join(os.path.dirname(__file__), "..", "..")
    candidates.append(os.path.join(base, "frontend", "public", relative))
    candidates.append(os.path.join(base, "frontend", "dist", relative))
    for c in candidates:
        if os.path.isfile(c):
            with open(c, "rb") as f:
                return f.read()
    return None


def _winner_for_race(race_id: int, season_id: int) -> dict | None:
    """Return the human P1 finisher for a race, applying AI substitute remap."""
    row = execute(
        """
        SELECT COALESCE(h.id, sd.id) AS effective_driver_id, rr.grid_position
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
        WHERE rr.race_id = ? AND rr.position = 1 AND rr.status = 'finished'
        LIMIT 1
        """,
        (season_id, race_id), fetch="one"
    )
    if not row or not row.get("effective_driver_id"):
        return None
    driver = execute("SELECT * FROM drivers WHERE id = ?", (row["effective_driver_id"],), fetch="one")
    if driver:
        driver["grid_position"] = row.get("grid_position")
    return driver


def _classify_podium(race_id: int) -> str:
    """Compute a podium tag for the race: dominant/close/comeback or empty."""
    results = execute(
        """SELECT position, grid_position, total_time_s
           FROM race_results
           WHERE race_id = ? AND status = 'finished'
           ORDER BY position
           LIMIT 2""",
        (race_id,)
    )
    if len(results) >= 2 and results[0].get("total_time_s") and results[1].get("total_time_s"):
        gap = results[1]["total_time_s"] - results[0]["total_time_s"]
        if gap > 5: return "dominant"
        if gap < 2: return "close"
    if results:
        winner = results[0]
        if winner.get("grid_position") and winner["grid_position"] - 1 > 5:
            return "comeback"
    return ""


@router.get("/races/{race_id}/celebration-suggestion")
async def suggest_celebration_template(race_id: int):
    """Pick a default template based on country tag and podium type."""
    race = execute("SELECT * FROM races WHERE id = ?", (race_id,), fetch="one")
    if not race:
        return {"error": "Race not found."}
    podium = _classify_podium(race_id)
    country = race.get("country", "") or ""
    candidate = execute(
        """SELECT * FROM celebration_templates
           WHERE is_active = 1 AND image_path != ''
           ORDER BY
               CASE WHEN LOWER(country_tag) = LOWER(?) AND country_tag != '' THEN 0 ELSE 1 END,
               CASE WHEN podium_tag = ? AND podium_tag != '' THEN 0 ELSE 1 END,
               sort_order, id
           LIMIT 1""",
        (country, podium), fetch="one"
    )
    return {
        "template_id": candidate["id"] if candidate else None,
        "country": country,
        "podium_tag": podium,
    }


@router.post("/races/{race_id}/generate-celebration-hero")
async def generate_celebration_hero(race_id: int, request: Request):
    """Run the driver photo + template through Gemini and save a preview image."""
    if not GEMINI_API_KEY:
        return {"error": "GEMINI_API_KEY not configured."}
    body = await request.json()
    template_id = body.get("template_id")
    driver_id = body.get("driver_id")
    requested_model = (body.get("model") or "").strip()
    # Allowlist the image-capable models the API key actually exposes.
    allowed_models = {
        "nano-banana-pro-preview",
        "gemini-3-pro-image-preview",
        "gemini-3.1-flash-image-preview",
        "gemini-2.5-flash-image",
    }
    model_to_use = requested_model if requested_model in allowed_models else "nano-banana-pro-preview"
    if not template_id:
        return {"error": "template_id is required."}

    race = execute("SELECT * FROM races WHERE id = ?", (race_id,), fetch="one")
    if not race:
        return {"error": "Race not found."}

    if driver_id:
        driver = execute("SELECT * FROM drivers WHERE id = ?", (driver_id,), fetch="one")
    else:
        driver = _winner_for_race(race_id, race["season_id"])
    if not driver:
        return {"error": "No P1 finisher found. Pick a driver explicitly."}

    template = execute(
        "SELECT * FROM celebration_templates WHERE id = ?", (template_id,), fetch="one"
    )
    if not template:
        return {"error": "Template not found."}
    if not template.get("image_path"):
        return {"error": "Template has no reference image yet — upload one first."}

    # Collect every available reference image for the driver: the standings
    # thumbnail, the full-body standing photo, and any extra reference photos
    # the admin has uploaded. More refs → better likeness from Gemini.
    ref_photo_rows = execute(
        "SELECT image_path FROM driver_reference_photos WHERE driver_id = ? ORDER BY sort_order, id",
        (driver["id"],)
    )
    ref_paths = []
    if driver.get("photo_url"):
        ref_paths.append(driver["photo_url"])
    if driver.get("photo_standing"):
        ref_paths.append(driver["photo_standing"])
    ref_paths.extend(r["image_path"] for r in ref_photo_rows if r.get("image_path"))

    driver_image_bytes = []
    for p in ref_paths:
        b = _load_image_bytes(p)
        if b:
            driver_image_bytes.append(b)
    if not driver_image_bytes:
        return {"error": f"{driver['name']} has no reference photos to use."}

    template_bytes = _load_image_bytes(template["image_path"])
    if not template_bytes:
        return {"error": "Couldn't load template reference image."}

    team = execute("SELECT name, color FROM teams WHERE id = ?", (driver.get("team_id"),), fetch="one") if driver.get("team_id") else None
    team_name = team["name"] if team else ""

    team_line = (
        f"The driver races for {team_name}; use that team's race suit and helmet colours where appropriate. "
        if team_name else ""
    )
    track_name = race.get("track_name") or ""
    country = race.get("country") or ""
    venue_line = ""
    if track_name or country:
        where = ", ".join(x for x in [track_name, country] if x)
        circuit_note = _circuit_note(race)
        venue_line = (
            f"VENUE: this celebration takes place at {where}. "
            "Make the location recognizable through its distinctive architecture, "
            "grandstands, signage, surrounding terrain, and trackside details. "
        )
        if circuit_note:
            venue_line += f"Iconic features to incorporate: {circuit_note} "
    # Order of multimodal inputs matters: many image-gen models weight the
    # LAST visual inputs more heavily for identity. Put the scene template
    # first (so the model treats it as backdrop), then the driver references
    # last so their face is the dominant identity signal.
    n_refs = len(driver_image_bytes)
    template_index = 1
    refs_start = 2
    refs_end = 1 + n_refs

    likeness_notes = (driver.get("likeness_notes") or "").strip()
    likeness_line = (
        f"\n\nWritten description of the driver to anchor identity (use these features "
        f"in conjunction with the reference photos): {likeness_notes}\n"
        if likeness_notes else ""
    )

    refs_descriptor = (
        f"Images {refs_start}–{refs_end} are reference portraits of the SAME driver from "
        "different angles and expressions — use them together to lock in the face, hair, "
        "build, and overall likeness."
        if n_refs > 1 else
        f"Image {refs_start} is a portrait of the driver — preserve their face, hair, and likeness."
    )
    prompt = (
        "You are generating an ultra-wide cinematic hero banner for an amateur sim "
        "racing league recap website. The image will be displayed as a wide banner "
        "across the top of the page (roughly 3:1 visible area), with a dark text "
        "panel overlaid on the LEFT THIRD of the frame.\n\n"
        f"Image {template_index} is a SCENE / COMPOSITION reference only. Use it for the "
        "pose, framing, environment, lighting style, and props (champagne, trophy, "
        "podium, helmet, etc.). DO NOT copy any face from this scene reference — the "
        "person shown in the scene reference is irrelevant to identity. Their face must "
        "be REPLACED with the driver from the portrait references below.\n\n"
        f"{refs_descriptor} These reference photos are the SOLE source of truth for the "
        "person's face, hair, build, and identity.\n\n"
        f"{team_line}{venue_line}"
        "OUTPUT FORMAT (CRITICAL):\n"
        "- Produce ONE single, seamless, continuous photograph captured from ONE camera "
        "  angle. The reference images are inputs only — DO NOT lay them out side by "
        "  side, DO NOT produce a collage, diptych, split-screen, panel, polyptych, or "
        "  any kind of multi-panel composition. There must be NO visible vertical or "
        "  horizontal seam dividing the image. The whole 16:9 frame must read as one "
        "  unbroken photograph with consistent lighting, depth of field, perspective, "
        "  and camera position throughout.\n\n"
        "IDENTITY RULES (highest priority — read carefully):\n"
        "- The driver in the output is NOT a real, famous, or professional Formula 1 "
        "  driver. Do not generate Max Verstappen, Lewis Hamilton, Charles Leclerc, "
        "  Lando Norris, or any other real-world F1 driver. Do not default to a generic "
        "  young clean-shaven motorsport star. The person you must render is the "
        "  specific individual shown in the portrait references — likely an everyday "
        "  adult, possibly older, possibly bearded, possibly wearing glasses, possibly "
        "  not athletic-looking — exactly as they appear in the references.\n"
        f"- The output must clearly look like the SAME PERSON shown in images "
        f"{refs_start}–{refs_end}. Match face shape, eye shape & colour, eyebrows, nose, "
        "  jawline, beard/stubble pattern, glasses (if present), skin tone, and hair "
        "  colour & style exactly.\n"
        "- The face in image 1 (the scene reference) must be IGNORED and replaced by "
        "  this person's face. Treat image 1 as a photograph from which you keep "
        "  EVERYTHING EXCEPT the face.\n"
        "- If the reference person doesn't look like a typical pro racing driver, that's "
        "  fine — render them as they actually look. Do not stylise or beautify the face.\n"
        f"{likeness_line}\n"
        f"Render this single photograph: this specific person in the celebration moment "
        f"described by the scene reference: {template['prompt']}\n\n"
        "COMPOSITION RULES — read carefully, the final crop is aggressive:\n"
        "- The output is 16:9, but it will be displayed in a banner roughly 3:1 wide. "
        "  The visible band on screen is the source image rows from y=33% to y=73% "
        "  (a horizontal slice through the middle); the top ~33% and the bottom ~27% "
        "  WILL BE CROPPED OUT.\n"
        "- ANCHOR THE DRIVER'S CHEST AT y=53% of the image. The center of the upper "
        "  torso (sternum / mid-chest, where a logo would sit on the race suit) must "
        "  land at approximately 53% from the top of the 16:9 frame. Position the "
        "  rest of the body around this anchor — head/helmet upward, hands and any "
        "  held object (bottle, trophy) downward from there.\n"
        "- That anchor places the chest at the vertical centre of the cropped banner "
        "  on the live site, with the face naturally ending up around y=38%–45% (in "
        "  the upper half of the visible band) and full headroom above.\n"
        "- Everything that matters — face, hands, champagne bottle, trophy, key "
        "  venue signage, crowd faces — must sit fully within y=33%–73% of the "
        "  source. Anything outside that band is decorative and will be cropped.\n"
        "- The driver sits roughly in the RIGHT HALF of the frame.\n"
        "- The full image must be one consistent, sharply rendered photograph end to "
        "  end. Do NOT add fake blur, vignettes, or low-contrast washes anywhere — "
        "  the left side of the frame must be the same level of sharpness and detail "
        "  as the right side. A dark UI panel will be overlaid on top of part of the "
        "  image at display time, so you do not need to leave the left side empty or "
        "  quiet — fill it with normal scene content (crowd, grandstand, track, sky, "
        "  flags) at full fidelity.\n"
        "- Photorealistic, crisp focus on the driver, cinematic lighting, 16:9. One "
        "  photograph, one moment, one camera."
    )

    try:
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=GEMINI_API_KEY)
        # Template (scene) first, driver references last — most image-gen models
        # weight the trailing visual inputs more strongly for identity, so we
        # want the driver's face to be the dominant signal.
        contents = [
            prompt,
            types.Part.from_bytes(data=template_bytes, mime_type="image/png"),
        ]
        for b in driver_image_bytes:
            contents.append(types.Part.from_bytes(data=b, mime_type="image/png"))
        response = client.models.generate_content(
            model=model_to_use,
            contents=contents,
            config={
                "response_modalities": ["IMAGE", "TEXT"],
                "image_config": {"aspect_ratio": "16:9"},
            },
        )
        image_bytes = None
        for cand in response.candidates or []:
            for part in cand.content.parts or []:
                if getattr(part, "inline_data", None) and part.inline_data.data:
                    image_bytes = part.inline_data.data
                    break
            if image_bytes:
                break
        if not image_bytes:
            return {"error": "Gemini did not return an image."}

        os.makedirs(HEROES_DIR, exist_ok=True)
        filename = f"race_{race_id}_{int(time.time())}.png"
        filepath = os.path.join(HEROES_DIR, filename)
        with open(filepath, "wb") as f:
            f.write(image_bytes)
        image_path = f"/celebration_heroes/{filename}"
        candidate_id = execute(
            """INSERT INTO race_hero_candidates (race_id, image_path, template_id, driver_id, model)
               VALUES (?, ?, ?, ?, ?)""",
            (race_id, image_path, template_id, driver["id"], model_to_use), fetch="none"
        )
        return {
            "candidate_id": candidate_id,
            "image_path": image_path,
            "driver_name": driver["name"],
            "model": model_to_use,
        }
    except Exception as e:
        logger.exception("Celebration hero generation failed")
        return {"error": f"Generation failed: {str(e)}"}


@router.post("/races/{race_id}/hero-image")
async def commit_hero_image(race_id: int, request: Request):
    """Persist a chosen image path as the race's hero_image."""
    body = await request.json()
    image_path = (body.get("image_path") or "").strip()
    if not image_path:
        return {"error": "image_path is required."}
    execute("UPDATE races SET hero_image = ? WHERE id = ?", (image_path, race_id), fetch="none")
    return {"status": "updated", "hero_image": image_path}


@router.get("/races/{race_id}/hero-candidates")
async def list_hero_candidates(race_id: int):
    """List saved generations for a race, plus the currently-active hero path."""
    race = execute("SELECT hero_image FROM races WHERE id = ?", (race_id,), fetch="one")
    candidates = execute(
        """SELECT c.id, c.image_path, c.template_id, c.driver_id, c.model, c.created_at,
                  t.name AS template_name, d.name AS driver_name
           FROM race_hero_candidates c
           LEFT JOIN celebration_templates t ON c.template_id = t.id
           LEFT JOIN drivers d ON c.driver_id = d.id
           WHERE c.race_id = ?
           ORDER BY c.created_at DESC, c.id DESC""",
        (race_id,)
    )
    return {
        "active_hero_image": (race or {}).get("hero_image", ""),
        "candidates": candidates,
    }


@router.delete("/races/hero-candidates/{candidate_id}")
async def delete_hero_candidate(candidate_id: int):
    """Remove a saved candidate. Clears the race's active hero if it pointed here."""
    row = execute("SELECT race_id, image_path FROM race_hero_candidates WHERE id = ?", (candidate_id,), fetch="one")
    if not row:
        return {"status": "not_found"}
    execute("DELETE FROM race_hero_candidates WHERE id = ?", (candidate_id,), fetch="none")
    # If the active hero pointed at this candidate, clear it.
    execute(
        "UPDATE races SET hero_image = '' WHERE id = ? AND hero_image = ?",
        (row["race_id"], row["image_path"]), fetch="none"
    )
    candidate = row["image_path"] or ""
    if candidate:
        local = os.path.join("/data", candidate.lstrip("/")) if os.path.isdir("/data") else None
        if local and os.path.isfile(local):
            try:
                os.remove(local)
            except OSError:
                pass
    return {"status": "deleted"}


# ─── Highlights ─────────────────────────────────────────────────────

@router.get("/highlights")
async def list_highlights(race_id: int = None):
    if race_id:
        return execute("SELECT * FROM highlights WHERE race_id = ? ORDER BY sort_order", (race_id,))
    return execute("SELECT h.*, r.track_name FROM highlights h LEFT JOIN races r ON h.race_id = r.id ORDER BY h.race_id DESC, h.sort_order")


@router.post("/highlights")
async def create_highlight(request: Request):
    body = await request.json()
    race_id = body.get("race_id")
    title = body.get("title", "")
    youtube_url = body.get("youtube_url", "")

    if not race_id or not youtube_url:
        return {"error": "race_id and youtube_url are required."}

    highlight_id = execute(
        "INSERT INTO highlights (race_id, title, youtube_url) VALUES (?, ?, ?)",
        (race_id, title, youtube_url), fetch="none"
    )
    return {"id": highlight_id, "title": title}


@router.delete("/highlights/{highlight_id}")
async def delete_highlight(highlight_id: int):
    execute("DELETE FROM highlights WHERE id = ?", (highlight_id,), fetch="none")
    return {"status": "deleted"}


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

    for field in ("headline", "subtitle", "body", "hero_image", "race_id", "published", "featured"):
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
    user_context = body.get("context", "")

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

{f"Additional context from the league admin (use this to inform the story):{chr(10)}{user_context}{chr(10)}" if user_context else ""}Guidelines:
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

        # Auto-find a hero image: race hero > track image > winning team car
        hero_image = race.get("hero_image") or race.get("track_image") or ""
        if not hero_image and results:
            # Use the winning driver's team car image
            winner = results[0]
            winner_driver = execute(
                "SELECT t.car_image FROM drivers d LEFT JOIN teams t ON d.team_id = t.id WHERE d.id = ?",
                (winner.get("driver_id"),), fetch="one"
            )
            if winner_driver and winner_driver.get("car_image"):
                hero_image = winner_driver["car_image"]

        return {
            "headline": article_data.get("headline", ""),
            "subtitle": article_data.get("subtitle", ""),
            "body": article_data.get("body", ""),
            "hero_image": hero_image,
        }

    except Exception as e:
        logger.error("Article generation failed: %s", e, exc_info=True)
        return {"error": f"Generation failed: {str(e)}"}
