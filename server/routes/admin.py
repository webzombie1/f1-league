"""Admin CRUD endpoints — all routes prefixed with /api/admin."""

import json
import logging
import os
import shutil
import time
import urllib.request
from fastapi import APIRouter, Request, UploadFile, File
from server.db import execute, get_conn
from server.config import GEMINI_API_KEY, OPENAI_API_KEY

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

        # Try to match driver by registered name OR in-game ea_tag
        # (case-insensitive). The capture listener sends the gamertag, which
        # rarely matches drivers.name, but each driver's gamertag is stored
        # in drivers.ea_tag — so matching on either resolves cleanly.
        driver = execute(
            "SELECT id FROM drivers WHERE season_id = ? "
            "AND (LOWER(name) = LOWER(?) OR (ea_tag != '' AND LOWER(ea_tag) = LOWER(?)))",
            (race["season_id"], driver_name, driver_name), fetch="one"
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
        """INSERT INTO celebration_templates (name, prompt, country_tag, podium_tag, is_active, include_driver_refs, match_template, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (name, prompt,
         (body.get("country_tag") or "").strip(),
         (body.get("podium_tag") or "").strip(),
         1 if body.get("is_active", True) else 0,
         1 if body.get("include_driver_refs", True) else 0,
         1 if body.get("match_template", False) else 0,
         int(body.get("sort_order") or 0)),
        fetch="none"
    )
    return {"id": template_id}


@router.put("/celebration-templates/{template_id}")
async def update_celebration_template(template_id: int, request: Request):
    body = await request.json()
    updates = []
    params = []
    for field in ("name", "prompt", "country_tag", "podium_tag", "is_active", "include_driver_refs", "match_template", "sort_order"):
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


@router.post("/celebration-templates/{template_id}/trim-face")
async def trim_celebration_template_face(template_id: int):
    """Use Gemini to obscure the human face in a template's reference image so
    it can't bias hero generation. The original image is preserved alongside
    the trimmed version as <name>.original.<ext>; a second call to this
    endpoint replaces the face on the trimmed image again, but the .original
    backup is created only the first time so you can always revert."""
    if not GEMINI_API_KEY:
        return {"error": "GEMINI_API_KEY not configured."}
    template = execute(
        "SELECT * FROM celebration_templates WHERE id = ?", (template_id,), fetch="one"
    )
    if not template or not template.get("image_path"):
        return {"error": "Template has no image to trim."}

    image_bytes = _load_image_bytes(template["image_path"])
    if not image_bytes:
        return {"error": "Couldn't load the template image."}

    prompt = (
        "Edit this photograph so no human face is recognizable. Keep EVERYTHING else "
        "exactly the same — pose, body posture, race suit, team colours, helmet, "
        "trophies, champagne bottles, podium structures, signage, crowd, lighting, "
        "camera angle, background, and overall composition. Only change the face: "
        "replace each visible face with one of these options that fits the pose — \n"
        "(a) the helmet still on with the visor down (preferred when the body is in "
        "  driving / parc-fermé pose),\n"
        "(b) the head turned fully away from the camera so the face isn't visible,\n"
        "(c) the head cropped or dissolved into motion blur such that there is no "
        "  recognizable face but the body remains.\n"
        "Pick whichever looks most natural. The output must be a single photorealistic "
        "image at the same aspect ratio as the input. Do NOT swap the face for a "
        "different person's face — there should be no specific identifiable face at all."
    )

    try:
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=GEMINI_API_KEY)
        response = client.models.generate_content(
            model="nano-banana-pro-preview",
            contents=[
                prompt,
                types.Part.from_bytes(data=image_bytes, mime_type="image/png"),
            ],
            config={"response_modalities": ["IMAGE", "TEXT"]},
        )
        out_bytes = None
        for cand in response.candidates or []:
            for part in cand.content.parts or []:
                if getattr(part, "inline_data", None) and part.inline_data.data:
                    out_bytes = part.inline_data.data
                    break
            if out_bytes:
                break
        if not out_bytes:
            return {"error": "Gemini did not return an image."}

        rel = template["image_path"].lstrip("/")
        if os.path.isdir("/data"):
            target = os.path.join("/data", rel)
        else:
            base = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "public")
            target = os.path.join(base, rel)
        if not os.path.isfile(target):
            return {"error": "Template file missing on disk."}

        # Back up the original the first time we trim, so the user can revert.
        root, ext = os.path.splitext(target)
        backup = f"{root}.original{ext}"
        if not os.path.isfile(backup):
            shutil.copyfile(target, backup)

        with open(target, "wb") as f:
            f.write(out_bytes)
        return {"status": "trimmed", "image_path": template["image_path"]}
    except Exception as e:
        logger.exception("Template face trim failed")
        return {"error": f"Trim failed: {str(e)}"}


@router.post("/celebration-templates/{template_id}/restore-original")
async def restore_celebration_template_original(template_id: int):
    """Revert a trimmed template back to the original uploaded image."""
    template = execute(
        "SELECT image_path FROM celebration_templates WHERE id = ?", (template_id,), fetch="one"
    )
    if not template or not template.get("image_path"):
        return {"error": "Template has no image."}
    rel = template["image_path"].lstrip("/")
    if os.path.isdir("/data"):
        target = os.path.join("/data", rel)
    else:
        base = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "public")
        target = os.path.join(base, rel)
    root, ext = os.path.splitext(target)
    backup = f"{root}.original{ext}"
    if not os.path.isfile(backup):
        return {"error": "No original backup exists for this template."}
    shutil.copyfile(backup, target)
    return {"status": "restored", "image_path": template["image_path"]}


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
    body = await request.json()
    template_id = body.get("template_id")
    driver_id = body.get("driver_id")
    requested_model = (body.get("model") or "").strip()
    # Allowlist the image-capable models. The first four go through Gemini;
    # gpt-image-1 goes through OpenAI.
    gemini_models = {
        "nano-banana-pro-preview",
        "gemini-3-pro-image-preview",
        "gemini-3.1-flash-image-preview",
        "gemini-2.5-flash-image",
    }
    openai_models = {"gpt-image-1", "gpt-image-1-wide"}
    allowed_models = gemini_models | openai_models
    model_to_use = requested_model if requested_model in allowed_models else "nano-banana-pro-preview"

    is_openai = model_to_use in openai_models
    # gpt-image-1-wide = OpenAI generation followed by a Gemini outpaint pass
    # that extends the canvas leftward to ~2304x1024 for a more cinematic banner.
    wide_extend = model_to_use == "gpt-image-1-wide"
    if is_openai and not OPENAI_API_KEY:
        return {"error": "OPENAI_API_KEY not configured."}
    if not is_openai and not GEMINI_API_KEY:
        return {"error": "GEMINI_API_KEY not configured."}
    if wide_extend and not GEMINI_API_KEY:
        return {"error": "gpt-image-1-wide also requires GEMINI_API_KEY for the outpaint pass."}
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

    # Templates default to including the driver's reference photos for face
    # likeness. Car-/scene-focused templates (e.g. "car spinning doughnuts")
    # set include_driver_refs=0 — we then skip loading driver photos and use
    # a car-focused prompt that explicitly excludes a driver figure.
    include_driver_refs = bool(template.get("include_driver_refs", 1))
    # When match_template=1 the AI is told to faithfully recreate the template
    # image (preserve framing, pose, environment, mood) rather than build a new
    # scene around it. Skips venue invention. Driver likeness still applied if
    # include_driver_refs=1 and the template figure's face is visible (helmet
    # + visor → leave the face alone).
    match_template = bool(template.get("match_template", 0))

    driver_image_bytes = []
    if include_driver_refs:
        # Collect every available reference image for the driver: the standings
        # thumbnail, the full-body standing photo, and any extra reference photos
        # the admin has uploaded. More refs → better likeness.
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

        for p in ref_paths:
            b = _load_image_bytes(p)
            if b:
                driver_image_bytes.append(b)
        if not driver_image_bytes:
            return {"error": f"{driver['name']} has no reference photos to use."}

    template_bytes = _load_image_bytes(template["image_path"])
    if not template_bytes:
        return {"error": "Couldn't load template reference image."}

    team = execute("SELECT name, color, car_image FROM teams WHERE id = ?", (driver.get("team_id"),), fetch="one") if driver.get("team_id") else None
    team_name = team["name"] if team else ""

    # Car-/scene-focused templates: pass the team's car artwork as a second
    # reference so the AI matches the actual livery (colors, sponsors, design)
    # instead of inventing a generic one. Driver-portrait templates skip this
    # because the driver photos already carry team identity via the race suit.
    if not include_driver_refs and team and team.get("car_image"):
        car_ref = _load_image_bytes(team["car_image"])
        if car_ref:
            driver_image_bytes.append(car_ref)

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
    # Composition rules are shared between the driver-focused and car-focused
    # branches — same banner crop, same right-half placement, same y=55% anchor.
    # The only difference between branches is the noun used for the subject.
    composition_rules_for = lambda subject: (
        "COMPOSITION RULES — read carefully, the final crop is VERY aggressive:\n"
        "- The output is 16:9, but it will be displayed in a banner roughly 5:1 wide. "
        "  The visible band on screen is the source image rows from y=40% to y=70% "
        "  (a thin horizontal slice through the middle); the top ~40% and the bottom "
        "  ~30% WILL BE CROPPED OUT.\n"
        f"- ANCHOR THE {subject.upper()}'S CENTER AT y=55% of the image. Position the "
        f"  {subject} so its mid-point lands at approximately 55% from the top of the "
        "  16:9 frame.\n"
        f"- Frame the {subject} so all of its key features comfortably fit within "
        "  y=40%-70%. The visible band is only 30% of the source height — too wide a "
        "  shot wastes detail on cropped pixels.\n"
        "- Everything that matters — key venue signage, crowd faces, action elements — "
        "  must sit fully within y=40%-70% of the source. Anything outside that band "
        "  is decorative and will be cropped.\n"
        f"- The {subject} sits roughly in the RIGHT HALF of the frame.\n"
        "- The full image must be one consistent, sharply rendered photograph end to "
        "  end. Do NOT add fake blur, vignettes, or low-contrast washes anywhere — "
        "  the left side of the frame must be the same level of sharpness and detail "
        "  as the right side. A dark UI panel will be overlaid on top of part of the "
        "  image at display time, so you do not need to leave the left side empty or "
        "  quiet — fill it with normal scene content (crowd, grandstand, track, sky, "
        "  flags) at full fidelity.\n"
        "- Photorealistic, crisp focus, cinematic lighting, 16:9. One photograph, "
        "  one moment, one camera."
    )

    if match_template:
        # Faithful-recreation prompt: trust the template image as the canonical
        # scene. Skip venue invention. Driver likeness applied conditionally —
        # only when the figure's face is visible in the template.
        n_refs = len(driver_image_bytes)
        refs_start = 2
        refs_end = 1 + n_refs
        if include_driver_refs and n_refs > 0:
            likeness_block = (
                f"Images {refs_start}–{refs_end} are reference portraits of the driver.\n\n"
                "FACE HANDLING — read carefully:\n"
                "- IF AND ONLY IF the figure in Image 1 has their face clearly "
                "  visible (no helmet covering the face, no visor down, not turned "
                "  away from camera), replace that face with this driver's likeness. "
                "  Match face shape, eyebrows, nose, jawline, beard/stubble, "
                "  glasses (if present), skin tone, and hair colour & style exactly "
                "  to the reference portraits. Keep pose, body, clothing, and the "
                "  rest of the scene identical to Image 1.\n"
                "- IF the figure wears a helmet with the visor down, OR the face "
                "  is otherwise obscured (back to camera, distant, motion-blurred), "
                "  leave them entirely as-is in Image 1. Do NOT insert a face. "
                "  Do NOT remove the helmet.\n\n"
            )
        elif n_refs > 0:  # car ref present (no driver portraits)
            likeness_block = (
                f"Image {refs_start} is a reference of the team's actual car. If a "
                f"car appears in Image 1, apply this car's livery (colours, sponsor "
                f"logos and placement, design language) to it. Otherwise do not "
                f"alter Image 1's composition or anything else about the scene.\n\n"
            )
        else:
            likeness_block = (
                "Recreate Image 1 as faithfully as possible. Preserve any figures, "
                "vehicles, and objects in it as they appear.\n\n"
            )
        prompt = (
            "You are recreating a hero banner that is FAITHFUL to Image 1, the "
            "reference image. Image 1 is your CANONICAL source of truth — match "
            "its framing, composition, camera angle, environment, props, lighting, "
            "mood, pose, and visual style as closely as possible. The output "
            "should look like a high-fidelity recreation of Image 1, not a "
            "re-imagining.\n\n"
            "DO NOT invent or substitute a different venue, location, track, or "
            "stadium. The environment in the output must match what's shown in "
            "Image 1 — do not add real F1 circuit elements, grandstands, signage, "
            "team logos, flags, or other location-specific details that aren't "
            "already present in Image 1.\n\n"
            f"{likeness_block}"
            "OUTPUT FORMAT (CRITICAL):\n"
            "- Produce ONE single, seamless, continuous photograph captured from "
            "  ONE camera angle. The reference images are inputs only — DO NOT "
            "  lay them out side by side, DO NOT produce a collage, diptych, "
            "  split-screen, panel, polyptych, or any kind of multi-panel "
            "  composition. There must be NO visible vertical or horizontal seam "
            "  dividing the image. The whole 16:9 frame must read as one unbroken "
            "  photograph.\n\n"
            "COMPOSITION (banner crop):\n"
            "- The output is 16:9, displayed in a banner roughly 5:1 wide. The "
            "  visible band on screen is the source image rows from y=40% to "
            "  y=70% — the top ~40% and bottom ~30% WILL BE CROPPED OUT.\n"
            "- Match Image 1's composition. If the subject in Image 1 is already "
            "  positioned within the y=40%-70% band, preserve that exactly. If "
            "  the subject is positioned outside that band, gently reframe so "
            "  key elements fall within it — but otherwise keep Image 1's "
            "  framing intact.\n"
            "- Do NOT add fake blur, vignettes, or low-contrast washes anywhere. "
            "  The full image must be sharply rendered end to end at consistent "
            "  fidelity.\n"
            "- Photorealistic, crisp focus, cinematic lighting, 16:9. One "
            "  photograph, one moment, one camera."
        )
    elif include_driver_refs:
        # Order of multimodal inputs matters: many image-gen models weight the
        # LAST visual inputs more heavily for identity. Put the scene template
        # first (so the model treats it as backdrop), then the driver references
        # last so their face is the dominant identity signal.
        n_refs = len(driver_image_bytes)
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
            "racing league recap website. The image will be displayed as a very wide banner "
            "across the top of the page (roughly 5:1 visible area), with a dark text "
            "panel overlaid on the LEFT THIRD of the frame.\n\n"
            "Image 1 is a SCENE / COMPOSITION reference only. Use it for the "
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
            + composition_rules_for("driver")
        )
    else:
        # Car-/scene-focused template: no driver portrait refs, no identity rules,
        # explicitly exclude any human figure from the foreground.
        has_car_ref = len(driver_image_bytes) > 0  # actually a car ref in this branch
        car_ref_line = (
            "Image 2 is a reference of the team's actual car. Use it as the SOLE "
            "source of truth for the car's LIVERY: paint colours, sponsor logos and "
            "their placement, halo and engine cover design, sidepod shape, front "
            "wing endplate detail, and overall colour blocking. The car in the "
            "output must look like THIS car — not a generic F1 car, not a different "
            "team's car. Do not invent sponsor logos.\n\n"
            if has_car_ref else ""
        )
        car_team_line = (
            f"This is {team_name}'s car. " if team_name else ""
        )
        prompt = (
            "You are generating an ultra-wide cinematic hero banner for an amateur sim "
            "racing league recap website. The image will be displayed as a very wide banner "
            "across the top of the page (roughly 5:1 visible area), with a dark text "
            "panel overlaid on the LEFT THIRD of the frame.\n\n"
            "Image 1 is a SCENE / COMPOSITION reference. Use it for pose, framing, "
            "environment, lighting style, and action (smoke, motion blur, crowd, "
            "trackside details). Do NOT copy the car, livery, or any specific "
            "real-world team identity from this reference.\n\n"
            f"{car_ref_line}"
            f"{car_team_line}{venue_line}"
            "OUTPUT FORMAT (CRITICAL):\n"
            "- Produce ONE single, seamless, continuous photograph captured from ONE camera "
            "  angle. The reference image is an input only — DO NOT lay it out side by "
            "  side, DO NOT produce a collage, diptych, split-screen, panel, polyptych, or "
            "  any kind of multi-panel composition. There must be NO visible vertical or "
            "  horizontal seam dividing the image. The whole 16:9 frame must read as one "
            "  unbroken photograph with consistent lighting, depth of field, perspective, "
            "  and camera position throughout.\n\n"
            "FOCUS RULES (highest priority — read carefully):\n"
            "- This image is a CAR-/SCENE-focused shot, NOT a driver portrait. Do NOT "
            "  add a driver figure, podium person, marshal, or any close-up human face "
            "  in the foreground. Background or distant crowd is fine if implied by the "
            "  scene, but the foreground subject must be the car or the action described "
            "  below — never a person.\n"
            "- Do NOT add helmets being held aloft, drivers leaning out of cars, or any "
            "  other human-centred celebration motif. The action is the car itself.\n\n"
            f"Render this single photograph: {template['prompt']}\n\n"
            + composition_rules_for("car")
        )

    try:
        image_bytes = None
        if is_openai:
            # OpenAI gpt-image-1 takes a list of reference images via the
            # edits endpoint. Inputs must be PNG/JPEG/WEBP under modest size
            # limits — phone photos at full resolution and AVIF templates
            # both fail with "Invalid image file or mode". We normalise every
            # input through Pillow: convert to RGB, downscale to max 1280px
            # on the longest side, and re-encode as PNG.
            import io
            import base64
            from openai import OpenAI
            try:
                import pillow_avif  # noqa: F401  enables AVIF decoding in PIL
            except ImportError:
                pass
            from PIL import Image

            def _normalise(b: bytes) -> bytes:
                im = Image.open(io.BytesIO(b))
                if im.mode != "RGB":
                    im = im.convert("RGB")
                w, h = im.size
                m = max(w, h)
                if m > 1280:
                    s = 1280 / m
                    im = im.resize((int(w * s), int(h * s)), Image.LANCZOS)
                out = io.BytesIO()
                im.save(out, format="PNG", optimize=True)
                return out.getvalue()

            oai = OpenAI(api_key=OPENAI_API_KEY)
            files = []
            for idx, raw in enumerate([template_bytes] + driver_image_bytes):
                try:
                    norm = _normalise(raw)
                except Exception as e:
                    logger.warning("Skipping input %d (couldn't normalise): %s", idx, e)
                    continue
                buf = io.BytesIO(norm)
                buf.name = f"input_{idx}.png"
                files.append(buf)
            if not files:
                return {"error": "No valid input images after normalisation."}
            result = oai.images.edit(
                model="gpt-image-1",
                image=files,
                prompt=prompt,
                size="1536x1024",  # closest available to 16:9 (1.5:1)
                quality="high",
            )
            data = result.data[0]
            if getattr(data, "b64_json", None):
                image_bytes = base64.b64decode(data.b64_json)
            elif getattr(data, "url", None):
                image_bytes = urllib.request.urlopen(data.url, timeout=30).read()
            if not image_bytes:
                return {"error": "OpenAI did not return an image."}
        else:
            from google import genai
            from google.genai import types
            client = genai.Client(api_key=GEMINI_API_KEY)
            # Template (scene) first, driver references last — most image-gen
            # models weight the trailing visual inputs more strongly for
            # identity, so we want the driver's face to be the dominant signal.
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
            for cand in response.candidates or []:
                for part in cand.content.parts or []:
                    if getattr(part, "inline_data", None) and part.inline_data.data:
                        image_bytes = part.inline_data.data
                        break
                if image_bytes:
                    break
            if not image_bytes:
                return {"error": "Gemini did not return an image."}

        # ── Wide-extend pass (gpt-image-1-wide) ─────────────────────────
        # Take OpenAI's 1536x1024, place it on the right side of a 2304x1024
        # transparent canvas, and ask Gemini to fill the empty left strip with
        # a continuation of the venue. We then PIL-composite the original back
        # over the right portion (with a 64px feathered edge) so the OpenAI
        # subject pixels are preserved exactly — Gemini only contributes the
        # extension, never touches the face. If the Gemini call fails for any
        # reason, fall back silently to the unextended OpenAI image.
        if wide_extend:
            try:
                import io
                from PIL import Image
                from google import genai as g_genai
                from google.genai import types as g_types

                original = Image.open(io.BytesIO(image_bytes)).convert("RGB")
                ow, oh = original.size  # expected 1536, 1024
                extension_px = 768
                new_w = ow + extension_px  # 2304

                canvas = Image.new("RGBA", (new_w, oh), (0, 0, 0, 0))
                canvas.paste(original.convert("RGBA"), (extension_px, 0))
                canvas_buf = io.BytesIO()
                canvas.save(canvas_buf, format="PNG")
                canvas_bytes = canvas_buf.getvalue()

                outpaint_prompt = (
                    "This is a wide cinematic banner image where the LEFT portion "
                    "is empty/transparent and needs to be filled. The right portion "
                    "shows a Formula 1 celebration scene at a specific venue with a "
                    "driver in the foreground. EXTEND THE SCENE LEFTWARD into the "
                    "empty area: continue the grandstands, crowd, track surface, "
                    "trackside signage, sky, and lighting naturally outward to the "
                    "left edge. Match the camera perspective, focal length, depth "
                    "of field, lighting direction, color palette, and color grading "
                    "of the right portion EXACTLY. The result must read as ONE "
                    "seamless continuous photograph end to end, with no visible "
                    "vertical seam, taken from a single camera position. Do NOT "
                    "add any new people in the foreground of the extended area — "
                    "fill it with crowd in the mid/background, grandstand "
                    "structures, trackside, sky, run-off, or grass as appropriate. "
                    "Do NOT modify the existing right portion — preserve it pixel-"
                    "for-pixel. Do NOT change the aspect ratio or crop the image."
                )

                gclient = g_genai.Client(api_key=GEMINI_API_KEY)
                g_response = gclient.models.generate_content(
                    model="nano-banana-pro-preview",
                    contents=[
                        outpaint_prompt,
                        g_types.Part.from_bytes(data=canvas_bytes, mime_type="image/png"),
                    ],
                    config={"response_modalities": ["IMAGE", "TEXT"]},
                )
                extended_bytes = None
                for cand in g_response.candidates or []:
                    for part in cand.content.parts or []:
                        if getattr(part, "inline_data", None) and part.inline_data.data:
                            extended_bytes = part.inline_data.data
                            break
                    if extended_bytes:
                        break

                if extended_bytes:
                    extended = Image.open(io.BytesIO(extended_bytes)).convert("RGB")
                    if extended.size != (new_w, oh):
                        extended = extended.resize((new_w, oh), Image.LANCZOS)
                    # Build a feathered alpha mask: opaque across the original
                    # except for a 64px ramp on the LEFT edge that fades from
                    # 0 → 255. Pasting with this mask blends the seam.
                    feather = 64
                    mask = Image.new("L", (ow, oh), 255)
                    ramp = Image.new("L", (feather, 1))
                    for x in range(feather):
                        ramp.putpixel((x, 0), int(255 * x / max(1, feather - 1)))
                    mask.paste(ramp.resize((feather, oh)), (0, 0))
                    extended.paste(original, (extension_px, 0), mask)
                    out_buf = io.BytesIO()
                    extended.save(out_buf, format="PNG", optimize=True)
                    image_bytes = out_buf.getvalue()
                else:
                    logger.warning("Gemini outpaint returned no image; using OpenAI base.")
            except Exception:
                logger.exception("Wide-extend pass failed; using OpenAI base.")

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


@router.post("/races/{race_id}/edit-hero-candidate")
async def edit_hero_candidate(race_id: int, request: Request):
    """Take an existing candidate, send it back through OpenAI's edit endpoint
    with a targeted edit instruction, save the result as a NEW candidate.

    Output is always 1536x1024 — wide-extension is lost on edit (OpenAI's
    images.edit only emits its three fixed sizes), but the user can re-run
    gpt-image-1-wide on the result to widen it again.

    We pass ONLY the source image (not driver reference photos) — the source
    already has the locked-in face, and adding refs back can cause OpenAI to
    subtly redraw the face while it's editing the requested region.
    """
    body = await request.json()
    source_id = body.get("source_candidate_id")
    instruction = (body.get("edit_instruction") or "").strip()
    if not source_id:
        return {"error": "source_candidate_id is required."}
    if not instruction:
        return {"error": "edit_instruction is required."}
    if not OPENAI_API_KEY:
        return {"error": "OPENAI_API_KEY not configured."}

    source = execute(
        "SELECT * FROM race_hero_candidates WHERE id = ? AND race_id = ?",
        (source_id, race_id), fetch="one"
    )
    if not source:
        return {"error": "Source candidate not found."}

    source_bytes = _load_image_bytes(source.get("image_path"))
    if not source_bytes:
        return {"error": "Couldn't load source image."}

    edit_prompt = (
        "You are editing an existing hero banner photograph. The user has "
        "requested ONE targeted change:\n\n"
        f"EDIT REQUEST: {instruction}\n\n"
        "Apply ONLY this change. Keep EVERYTHING ELSE in the image identical "
        "to the input — same composition, same camera angle, same framing, "
        "same lighting direction, same color palette and grading, same person "
        "(preserve face shape, eye shape & color, eyebrows, nose, jawline, "
        "beard/stubble pattern, glasses if present, skin tone, hair colour & "
        "style EXACTLY), same race suit and helmet, same background, same "
        "crowd and grandstand, same trackside details, same weather and time "
        "of day. Do not regenerate, restyle, or recompose the rest of the "
        "image. Preserve the existing photographic style, sharpness, and "
        "quality.\n\n"
        "The output must remain ONE seamless continuous photograph. Do not "
        "introduce seams, panels, collage, diptych, or any multi-panel "
        "composition."
    )

    try:
        import io
        import base64
        from openai import OpenAI
        try:
            import pillow_avif  # noqa: F401
        except ImportError:
            pass
        from PIL import Image

        # Same normalisation as the generate endpoint.
        def _normalise(b: bytes) -> bytes:
            im = Image.open(io.BytesIO(b))
            if im.mode != "RGB":
                im = im.convert("RGB")
            w, h = im.size
            m = max(w, h)
            if m > 1280:
                s = 1280 / m
                im = im.resize((int(w * s), int(h * s)), Image.LANCZOS)
            out = io.BytesIO()
            im.save(out, format="PNG", optimize=True)
            return out.getvalue()

        norm = _normalise(source_bytes)
        buf = io.BytesIO(norm)
        buf.name = "input_0.png"

        oai = OpenAI(api_key=OPENAI_API_KEY)
        result = oai.images.edit(
            model="gpt-image-1",
            image=[buf],
            prompt=edit_prompt,
            size="1536x1024",
            quality="high",
        )
        data = result.data[0]
        image_bytes = None
        if getattr(data, "b64_json", None):
            image_bytes = base64.b64decode(data.b64_json)
        elif getattr(data, "url", None):
            image_bytes = urllib.request.urlopen(data.url, timeout=30).read()
        if not image_bytes:
            return {"error": "OpenAI did not return an image."}

        os.makedirs(HEROES_DIR, exist_ok=True)
        filename = f"race_{race_id}_{int(time.time())}.png"
        filepath = os.path.join(HEROES_DIR, filename)
        with open(filepath, "wb") as f:
            f.write(image_bytes)
        image_path = f"/celebration_heroes/{filename}"
        candidate_id = execute(
            """INSERT INTO race_hero_candidates (race_id, image_path, template_id, driver_id, model)
               VALUES (?, ?, ?, ?, ?)""",
            (race_id, image_path, source.get("template_id"), source.get("driver_id"), "gpt-image-1-edit"),
            fetch="none"
        )
        return {
            "candidate_id": candidate_id,
            "image_path": image_path,
            "model": "gpt-image-1-edit",
        }
    except Exception as e:
        logger.exception("Hero edit failed")
        return {"error": f"Edit failed: {str(e)}"}


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
