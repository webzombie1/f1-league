"""Central configuration for F1 League Tracker."""

import os
from dotenv import load_dotenv

load_dotenv()

# ---------------------
# App
# ---------------------
APP_PASSWORD = os.getenv("F1LEAGUE_PASSWORD", "")
API_KEY = os.getenv("F1LEAGUE_API_KEY", "")
TIMEZONE = os.getenv("TIMEZONE", "America/Chicago")

# ---------------------
# Database
# ---------------------
_DATA_DIR = "/data" if os.path.isdir("/data") else os.path.join(os.path.dirname(__file__), "..", "data")
DATABASE_PATH = os.path.join(_DATA_DIR, "f1league.db")
