"""SQLite database utilities for F1 League Tracker."""

import os
import sqlite3
from server.config import DATABASE_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS seasons (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    year        INTEGER NOT NULL,
    is_active   INTEGER DEFAULT 1,
    season_start TEXT DEFAULT '',
    race_day    INTEGER DEFAULT 3,
    race_time   TEXT DEFAULT '20:00',
    created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS points_config (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id   INTEGER NOT NULL,
    position    INTEGER NOT NULL,
    points      INTEGER NOT NULL,
    FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
    UNIQUE(season_id, position)
);

CREATE TABLE IF NOT EXISTS teams (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id   INTEGER NOT NULL,
    name        TEXT NOT NULL,
    color       TEXT NOT NULL DEFAULT '#333333',
    car_image   TEXT DEFAULT '',
    logo_url    TEXT DEFAULT '',
    sort_order  INTEGER DEFAULT 0,
    FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS drivers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id       INTEGER NOT NULL,
    team_id         INTEGER,
    name            TEXT NOT NULL,
    abbreviation    TEXT DEFAULT '',
    number          INTEGER,
    photo_url       TEXT DEFAULT '',
    photo_standing  TEXT DEFAULT '',
    ea_tag          TEXT DEFAULT '',
    platform        TEXT DEFAULT '',
    discord_name    TEXT DEFAULT '',
    discord_url     TEXT DEFAULT '',
    ai_substitute_id INTEGER,
    is_ai           INTEGER DEFAULT 0,
    is_active       INTEGER DEFAULT 1,
    FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS races (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id       INTEGER NOT NULL,
    round_number    INTEGER NOT NULL,
    track_name      TEXT NOT NULL,
    country         TEXT DEFAULT '',
    date            TEXT,
    time            TEXT DEFAULT '',
    status          TEXT DEFAULT 'upcoming',
    hero_image      TEXT DEFAULT '',
    hero_headline   TEXT DEFAULT '',
    hero_subtitle   TEXT DEFAULT '',
    track_image     TEXT DEFAULT '',
    FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
    UNIQUE(season_id, round_number)
);

CREATE TABLE IF NOT EXISTS race_results (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    race_id             INTEGER NOT NULL,
    driver_id           INTEGER,
    driver_name_raw     TEXT DEFAULT '',
    position            INTEGER,
    grid_position       INTEGER,
    laps_completed      INTEGER DEFAULT 0,
    status              TEXT DEFAULT 'finished',
    status_reason       TEXT DEFAULT '',
    best_lap_time_ms    INTEGER,
    quali_time_ms       INTEGER,
    total_time_s        REAL,
    penalties_time_s    INTEGER DEFAULT 0,
    num_penalties       INTEGER DEFAULT 0,
    num_pit_stops       INTEGER DEFAULT 0,
    points_awarded      INTEGER DEFAULT 0,
    fastest_lap         INTEGER DEFAULT 0,
    gap_to_leader       TEXT DEFAULT '',
    FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
    UNIQUE(race_id, driver_id)
);

CREATE TABLE IF NOT EXISTS off_weeks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id   INTEGER NOT NULL,
    date        TEXT NOT NULL,
    reason      TEXT DEFAULT '',
    FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS highlights (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    race_id     INTEGER NOT NULL,
    title       TEXT NOT NULL,
    youtube_url TEXT NOT NULL,
    sort_order  INTEGER DEFAULT 0,
    FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS articles (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    race_id         INTEGER,
    season_id       INTEGER NOT NULL,
    headline        TEXT NOT NULL,
    subtitle        TEXT DEFAULT '',
    body            TEXT DEFAULT '',
    hero_image      TEXT DEFAULT '',
    published       INTEGER DEFAULT 1,
    featured        INTEGER DEFAULT 0,
    created_at      TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE SET NULL,
    FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tyre_stints (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    result_id       INTEGER NOT NULL,
    stint_number    INTEGER NOT NULL,
    compound        TEXT NOT NULL,
    laps            INTEGER DEFAULT 0,
    FOREIGN KEY (result_id) REFERENCES race_results(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS celebration_templates (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    image_path      TEXT DEFAULT '',
    prompt          TEXT NOT NULL,
    country_tag     TEXT DEFAULT '',
    podium_tag      TEXT DEFAULT '',
    is_active       INTEGER DEFAULT 1,
    sort_order      INTEGER DEFAULT 0,
    created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS driver_reference_photos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    driver_id       INTEGER NOT NULL,
    image_path      TEXT NOT NULL,
    label           TEXT DEFAULT '',
    sort_order      INTEGER DEFAULT 0,
    created_at      TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
);
"""


CELEBRATION_SEED_TEMPLATES = [
    ("Champagne Spray", "champagne_spray", "Driver on the top step of an F1 podium, eyes shut, mouth open laughing, spraying a magnum of champagne in a wide arc — bright spray frozen mid-air. The track in front of the podium is FLOODED with fans who have rushed onto the circuit after the chequered flag, a sea of cheering people packed shoulder-to-shoulder with phones and team flags raised, photographers with long lenses pressed against the podium railing, confetti drifting down, golden sunset light."),
    ("Trophy Lift", "trophy_lift", "Driver on the F1 podium hoisting a winner's trophy high overhead with both hands, head tilted back, fireworks and confetti in the background, dramatic stadium lighting."),
    ("Helmet-Off Cockpit", "helmet_off_cockpit", "Driver still seated in the cockpit of his Formula 1 car after the chequered flag, helmet just removed and held in his lap, hair matted with sweat, eyes wide and grinning, mechanics rushing in around the car."),
    ("Garage Hug", "garage_hug", "Driver in race suit being mobbed by mechanics in matching team kit inside an F1 garage, group hug, headsets and laptops in the background, crew laughing."),
    ("Donuts on the Straight", "donuts_burnouts", "Formula 1 car performing celebratory donuts on the front straight after the race, thick white tyre smoke billowing, driver's arm out the cockpit waving a team flag, empty grandstands in the background."),
    ("P1 Board Pose", "p1_board", "Driver standing in parc fermé next to a track marshal holding the large 'P1' board, fist pump in the air, helmet still on with visor up, photographers and team principal nearby."),
    ("Parc Fermé Interview", "parc_ferme_interview", "Driver in race suit, helmet under one arm, being interviewed in parc fermé with a microphone in his face, soaked in champagne, smiling broadly, blurred crowd of media and crew behind."),
    ("On Top of the Car", "on_top_of_car", "Driver standing on top of his Formula 1 car in parc fermé, both arms raised in triumph, helmet off, race suit unzipped to the waist, grandstand crowd cheering behind, classic Senna-style victory pose."),
    ("Kneel Beside the Car", "kneel_beside_car", "Driver kneeling on the asphalt next to his Formula 1 car after the race, head bowed against the sidepod, hand resting on the bodywork — quiet, emotional moment, soft late-afternoon light."),
    ("National Anthem", "national_anthem", "Driver standing on top step of the F1 podium during the national anthem, hand placed over his heart, head slightly bowed, trophy at his feet, flag rising behind, golden hour light."),
    ("Team Principal Hug", "team_principal_hug", "Driver in race suit hugging his team principal in parc fermé, both wearing team gear, big grins, team radio headsets visible, crew clapping in the background."),
    ("Cockpit Fist Pump", "cockpit_fist_pump", "Wide shot of an F1 car on the in-lap straight after winning, driver's gloved fists raised out of the cockpit pumping in the air, motion blur, sun flare across the camera."),
    ("Trophy Walk", "trophy_walk", "Driver in race suit walking back toward his garage holding the winner's trophy under one arm, helmet under the other, fans on a fence reaching toward him, paddock in the background."),
    ("Confetti Shower", "confetti_shower", "Tight portrait of a driver on the F1 podium with gold and silver confetti streaming down around him, blurred celebration in the background, broad smile, eyes closed in the moment."),
    ("Pit Wall Jump", "pit_wall_jump", "Driver in race suit leaping up onto the top of the pit wall after winning, arms raised in celebration, team crew on the wall waving flags and headsets, pit lane action behind."),
]


def get_conn() -> sqlite3.Connection:
    """Get a database connection with row factory enabled."""
    os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=5000")
    return conn


def init_db():
    """Create all tables if they don't exist, and migrate missing columns."""
    conn = get_conn()
    conn.executescript(SCHEMA)

    # Migrate: add columns that may be missing on older databases
    migrations = [
        ("races", "hero_image", "TEXT DEFAULT ''"),
        ("races", "hero_headline", "TEXT DEFAULT ''"),
        ("races", "hero_subtitle", "TEXT DEFAULT ''"),
        ("races", "track_image", "TEXT DEFAULT ''"),
        ("teams", "car_image", "TEXT DEFAULT ''"),
        ("teams", "logo_url", "TEXT DEFAULT ''"),
        ("drivers", "photo_url", "TEXT DEFAULT ''"),
        ("articles", "featured", "INTEGER DEFAULT 0"),
        ("race_results", "quali_time_ms", "INTEGER"),
        ("drivers", "photo_standing", "TEXT DEFAULT ''"),
        ("drivers", "ea_tag", "TEXT DEFAULT ''"),
        ("drivers", "platform", "TEXT DEFAULT ''"),
        ("drivers", "discord_name", "TEXT DEFAULT ''"),
        ("drivers", "discord_url", "TEXT DEFAULT ''"),
        ("drivers", "ai_substitute_id", "INTEGER"),
        ("drivers", "is_ai", "INTEGER DEFAULT 0"),
        ("seasons", "season_start", "TEXT DEFAULT ''"),
        ("seasons", "race_day", "INTEGER DEFAULT 3"),
        ("seasons", "race_time", "TEXT DEFAULT '20:00'"),
    ]
    for table, column, col_type in migrations:
        try:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
        except Exception:
            pass  # Column already exists

    # Seed celebration templates on a fresh table; never overwrite existing rows
    # so an admin can rename, retag, or delete without them coming back.
    existing = conn.execute("SELECT COUNT(*) AS c FROM celebration_templates").fetchone()
    if existing["c"] == 0:
        for i, (name, _slug, prompt) in enumerate(CELEBRATION_SEED_TEMPLATES):
            conn.execute(
                "INSERT INTO celebration_templates (name, prompt, sort_order) VALUES (?, ?, ?)",
                (name, prompt, i),
            )

    conn.commit()
    conn.close()


def execute(sql: str, params: tuple = (), fetch: str = "all") -> list | dict | None:
    """Execute a SQL query and return results.

    Args:
        sql: SQL query string.
        params: Query parameters.
        fetch: "all" for list of rows, "one" for single row, "none" for no return.

    Returns:
        List of dicts, single dict, or None.
    """
    conn = get_conn()
    cursor = conn.execute(sql, params)

    if fetch == "none":
        conn.commit()
        last_id = cursor.lastrowid
        conn.close()
        return last_id

    if fetch == "one":
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None

    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]
