# GDR League — F1 25 Esports League Tracker

A full-stack web app for tracking an F1 25 esports league with live UDP telemetry capture. Dark gaming-aesthetic UI with green accent, race results auto-ingested from the game.

## Features

- **Home** — Hero banner with last race headline/image, horizontally scrollable race result tiles with team colors and driver thumbnails, driver standings, next race card
- **Driver Standings** — Full championship table with points, wins, podiums, DNFs
- **Constructor Standings** — Team points aggregated from both drivers
- **Schedule** — Season calendar with completed/upcoming status
- **Race Results** — Detailed per-race classification with positions, gaps, fastest laps, pit stops, tyre strategy
- **Teams** — Team grid with color accents and driver rosters
- **Driver Profiles** — Stats and race-by-race results
- **Admin Panel** — Password-protected management for seasons, teams, drivers, schedule, results, and points config

## Tech Stack

- **Backend:** FastAPI (Python), SQLite, deployed on Fly.io with persistent volume
- **Frontend:** React + Vite + Tailwind CSS, dark navy theme with green accent
- **Capture Tool:** Python UDP listener for F1 25 telemetry (port 20777)

## Race Data Capture

F1 25 broadcasts UDP telemetry on port 20777. The capture tool runs on your gaming PC during races and auto-uploads results when the race finishes.

```bash
cd capture
pip install -r requirements.txt
python listener.py --race-id 3 --api-url https://f1-league.fly.dev --api-key YOUR_KEY
```

The tool captures:
- Final Classification (positions, DNFs, lap times, penalties, tyre stints)
- Participant data (driver names, teams)
- Fastest lap events

## Project Structure

```
f1-league/
  server/
    app.py               # FastAPI app, CORS, auth middleware, static serving
    db.py                # SQLite schema and query helpers
    config.py            # Environment config
    routes/
      auth.py            # Password login with session cookies + API key auth
      admin.py           # CRUD for seasons, teams, drivers, races, results, points
      standings.py       # Driver + constructor standings queries
      races.py           # Race schedule and detail with results
      drivers.py         # Driver list and profiles
      teams.py           # Team list and detail
      seasons.py         # Season endpoints
  capture/
    listener.py          # UDP listener (runs on gaming PC)
    packets.py           # F1 25 packet struct definitions
    uploader.py          # POST results to API
  frontend/
    src/
      App.jsx            # react-router-dom routing
      components/
        Layout.jsx       # Top nav with centered logo, split nav links
        TyreChip.jsx     # Tyre compound badge (S/M/H/I/W)
        StatBadge.jsx    # Stat display component
      pages/
        Home.jsx         # Hero banner, race results scroller, standings
        DriverStandings.jsx
        ConstructorStandings.jsx
        Schedule.jsx
        RaceResult.jsx
        Teams.jsx, TeamDetail.jsx
        DriverProfile.jsx
        admin/           # Login, seasons, teams, drivers, schedule, results, points
  Dockerfile             # Multi-stage Node + Python build
  fly.toml               # Fly.io config (ord region, persistent volume)
```

## Deployment

```bash
fly deploy
fly secrets set F1LEAGUE_PASSWORD=your_password F1LEAGUE_API_KEY=your_api_key
```

## Admin

Login at `/admin` with the configured password. From there you can:
- Create seasons and set the active one
- Add teams with colors matching their F1 liveries
- Register drivers and assign them to teams
- Build the race schedule with track names, dates, and hero images
- Edit race results and override points after capture
- Configure the points system (default: standard F1 25-18-15-12-10-8-6-4-2-1 + fastest lap)

Each race supports a `hero_headline`, `hero_subtitle`, and `hero_image` that display on the home page hero banner after the race is completed.
