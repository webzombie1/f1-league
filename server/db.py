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

CREATE TABLE IF NOT EXISTS articles (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    race_id         INTEGER,
    season_id       INTEGER NOT NULL,
    headline        TEXT NOT NULL,
    subtitle        TEXT DEFAULT '',
    body            TEXT DEFAULT '',
    hero_image      TEXT DEFAULT '',
    published       INTEGER DEFAULT 1,
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
"""


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
        ("drivers", "photo_standing", "TEXT DEFAULT ''"),
        ("drivers", "ea_tag", "TEXT DEFAULT ''"),
        ("drivers", "platform", "TEXT DEFAULT ''"),
        ("drivers", "discord_name", "TEXT DEFAULT ''"),
        ("drivers", "discord_url", "TEXT DEFAULT ''"),
        ("seasons", "season_start", "TEXT DEFAULT ''"),
        ("seasons", "race_day", "INTEGER DEFAULT 3"),
        ("seasons", "race_time", "TEXT DEFAULT '20:00'"),
    ]
    for table, column, col_type in migrations:
        try:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
        except Exception:
            pass  # Column already exists

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
