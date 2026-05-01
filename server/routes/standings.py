"""Driver and constructor standings."""
from fastapi import APIRouter, Query
from server.db import execute

router = APIRouter()


def _resolved_results_for_season(season_id: int):
    """Return race_results joined to their effective driver (AI subs remapped
    to the human, name-fallback when driver_id is null), restricted to the
    season's completed races."""
    return execute(
        """
        SELECT
            rr.race_id,
            rr.points_awarded,
            COALESCE(h.id, sd.id) AS effective_driver_id,
            COALESCE(h.team_id, sd.team_id) AS effective_team_id
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
        WHERE rr.race_id IN (
            SELECT id FROM races WHERE season_id = ? AND status = 'completed'
        )
        """,
        (season_id, season_id)
    )


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

    # Mirror the driver-standings remap so AI substitute results are credited
    # to the human's team. AI drivers are excluded from the team's driver
    # list — their points reach the team via the human they sub for.
    return execute("""
        SELECT
            t.id,
            t.name,
            t.color,
            t.logo_url,
            COALESCE(SUM(r.points_awarded), 0) AS points,
            COALESCE(SUM(CASE WHEN r.position = 1 THEN 1 ELSE 0 END), 0) AS wins,
            COALESCE(SUM(CASE WHEN r.position <= 3 AND r.position IS NOT NULL THEN 1 ELSE 0 END), 0) AS podiums
        FROM teams t
        LEFT JOIN drivers d ON d.team_id = t.id AND d.is_active = 1 AND d.is_ai = 0
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
        WHERE t.season_id = ?
        GROUP BY t.id
        ORDER BY points DESC, wins DESC
    """, (season_id, season_id))


@router.get("/standings/drivers/timeline")
async def driver_standings_timeline(season_id: int = Query(None)):
    """Cumulative points per human driver after each completed race."""
    if not season_id:
        season = execute("SELECT id FROM seasons WHERE is_active = 1 LIMIT 1", fetch="one")
        if not season:
            return {"races": [], "drivers": []}
        season_id = season["id"]

    races = execute(
        "SELECT id, round_number, track_name, country FROM races "
        "WHERE season_id = ? AND status = 'completed' ORDER BY round_number",
        (season_id,)
    )
    drivers = execute(
        "SELECT d.id, d.name, d.photo_url, t.name AS team_name, t.color AS team_color "
        "FROM drivers d LEFT JOIN teams t ON d.team_id = t.id "
        "WHERE d.season_id = ? AND d.is_active = 1 AND d.is_ai = 0 ORDER BY d.id",
        (season_id,)
    )
    if not races or not drivers:
        return {"races": races, "drivers": []}

    # Sum points per (race_id, effective_driver_id)
    points_by_race = {r["id"]: {} for r in races}
    for row in _resolved_results_for_season(season_id):
        eff = row["effective_driver_id"]
        if eff is None:
            continue
        rid = row["race_id"]
        if rid in points_by_race:
            points_by_race[rid][eff] = points_by_race[rid].get(eff, 0) + (row["points_awarded"] or 0)

    out = []
    for d in drivers:
        cum = []
        running = 0
        for race in races:
            running += points_by_race[race["id"]].get(d["id"], 0)
            cum.append(running)
        out.append({
            "id": d["id"],
            "name": d["name"],
            "photo_url": d["photo_url"],
            "team_name": d["team_name"],
            "team_color": d["team_color"],
            "points_per_round": cum,
        })
    out.sort(key=lambda x: -x["points_per_round"][-1])

    return {
        "races": [{"id": r["id"], "round_number": r["round_number"], "track_name": r["track_name"], "country": r["country"]} for r in races],
        "drivers": out,
    }


@router.get("/standings/constructors/timeline")
async def constructor_standings_timeline(season_id: int = Query(None)):
    """Cumulative points per team after each completed race."""
    if not season_id:
        season = execute("SELECT id FROM seasons WHERE is_active = 1 LIMIT 1", fetch="one")
        if not season:
            return {"races": [], "teams": []}
        season_id = season["id"]

    races = execute(
        "SELECT id, round_number, track_name, country FROM races "
        "WHERE season_id = ? AND status = 'completed' ORDER BY round_number",
        (season_id,)
    )
    teams = execute(
        "SELECT id, name, color, logo_url FROM teams WHERE season_id = ? ORDER BY id",
        (season_id,)
    )
    if not races or not teams:
        return {"races": races, "teams": []}

    points_by_race = {r["id"]: {} for r in races}
    for row in _resolved_results_for_season(season_id):
        team_id = row["effective_team_id"]
        if team_id is None:
            continue
        rid = row["race_id"]
        if rid in points_by_race:
            points_by_race[rid][team_id] = points_by_race[rid].get(team_id, 0) + (row["points_awarded"] or 0)

    out = []
    for t in teams:
        cum = []
        running = 0
        for race in races:
            running += points_by_race[race["id"]].get(t["id"], 0)
            cum.append(running)
        out.append({
            "id": t["id"],
            "name": t["name"],
            "team_color": t["color"],
            "team_logo": t["logo_url"],
            "points_per_round": cum,
        })
    out.sort(key=lambda x: -x["points_per_round"][-1])

    return {
        "races": [{"id": r["id"], "round_number": r["round_number"], "track_name": r["track_name"], "country": r["country"]} for r in races],
        "teams": out,
    }
