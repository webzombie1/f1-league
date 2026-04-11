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
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Create all tables if they don't exist."""
    conn = get_conn()
    conn.executescript(SCHEMA)
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
