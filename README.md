# GDR League — F1 25 Esports League Tracker

A full-stack web app for tracking an F1 25 esports league with live UDP telemetry capture. Dark gaming-aesthetic UI with green accent, race results auto-ingested from the game.

## Features

### Public Site
- **Home** — Hero banner with race recap headline/image, horizontally scrollable race result tiles with team car images and logos, video highlights section, podium cards with driver photos and team colors, driver/constructor standings with tab switcher, next race card with track image
- **Articles** — Gemini AI-generated comedic race recaps with fake driver quotes, linked from the hero banner
- **Driver Standings** — Full championship table with points, wins, podiums, DNFs
- **Constructor Standings** — Team points with official F1 team logos
- **Schedule** — Season calendar with completed/upcoming status
- **Race Results** — Detailed per-race classification with positions, gaps, fastest laps, pit stops, tyre strategy
- **Teams** — Team grid with color accents, car images, and driver rosters
- **Driver Profiles** — Stats and race-by-race results with driver photos

### Admin Panel
- **Schedule Management** — Searchable F1 25 track picker with GP name/city/country, auto-dating based on season settings (race day, time, start date), drag-to-reorder with automatic date recalculation, inline date editing, bulk operations
- **Season Settings** — Configurable race day, time, and start date saved per season. Off weeks/holidays that the schedule respects when calculating dates. Push this week's race button for quick delays
- **Teams** — Inline-editable team colors, car images, and official F1 logos
- **Drivers** — Full names, numbers, abbreviations, team assignments, EA tags, platform (Steam/PlayStation/Xbox/AI), Discord name/URL, photo uploads (thumbnail + standing), expandable inline editing
- **Results** — Manual entry with qualifying positions/times, race positions, fastest lap times, DNF/DSQ/DNS status. Edit existing results inline. Auto-calculates points from position
- **Articles** — Write or auto-generate race recaps using Gemini AI, with headline, subtitle, body, and hero image
- **Points** — Configurable points system (default: standard F1)

## Tech Stack

- **Backend:** FastAPI (Python), SQLite with WAL mode, deployed on Fly.io with persistent volume
- **Frontend:** React + Vite + Tailwind CSS, dark navy theme with green accent
- **AI:** Google Gemini for article generation
- **Capture Tool:** Python UDP listener for F1 25 telemetry (port 20777)

## Race Data Capture

F1 25 broadcasts UDP telemetry on port 20777. The capture tool runs on your Windows gaming PC during races and auto-uploads results when the race finishes.

```bash
cd capture
pip install -r requirements.txt
python listener.py --race-id 3 --api-url https://f1-league.fly.dev --api-key YOUR_KEY
```

The `--race-id` is shown in the admin schedule page under each race. The tool captures:
- Final Classification (positions, DNFs, lap times, penalties, tyre stints)
- Participant data (driver names, teams)
- Fastest lap events

## Project Structure

```
f1-league/
  server/
    app.py               # FastAPI app, CORS, auth middleware, SPA catch-all
    db.py                # SQLite schema, migrations, query helpers
    config.py            # Environment config (app password, API key, Gemini)
    routes/
      auth.py            # Password login with session cookies + API key auth
      admin.py           # CRUD for seasons, teams, drivers, races, results, points, articles, off-weeks
      standings.py       # Driver + constructor standings queries
      races.py           # Race schedule and detail with results
      drivers.py         # Driver list and profiles
      teams.py           # Team list and detail
      seasons.py         # Season endpoints + public off-weeks
      articles.py        # Public article endpoints
  capture/
    listener.py          # UDP listener (runs on Windows gaming PC)
    packets.py           # F1 25 packet struct definitions
    uploader.py          # POST results to API
  frontend/
    public/
      cars/              # Team car images (PNG)
      drivers/           # Driver photos (transparent PNG)
      tracks/            # Track layout SVGs
    src/
      App.jsx            # react-router-dom routing
      api.js             # Fetch wrapper
      components/
        Layout.jsx       # Top nav with diagonal stripes, centered logo, trophy icon
        TyreChip.jsx     # Tyre compound badge (S/M/H/I/W)
        StatBadge.jsx    # Stat display component
      pages/
        Home.jsx         # Hero, results scroller, highlights, podium cards, standings
        Article.jsx      # Race recap article page
        DriverStandings.jsx
        ConstructorStandings.jsx
        Schedule.jsx
        RaceResult.jsx
        Teams.jsx, TeamDetail.jsx
        DriverProfile.jsx
        admin/           # Login, layout, seasons, teams, drivers, schedule, results, points, articles
  Dockerfile             # Multi-stage Node + Python build
  fly.toml               # Fly.io config (ord region, persistent volume)
```

## Deployment

```bash
fly deploy
fly secrets set F1LEAGUE_PASSWORD=your_password F1LEAGUE_API_KEY=your_api_key GEMINI_API_KEY=your_gemini_key
```

## Admin

Login at `/admin` with the configured password. The schedule page shows the race ID needed for the capture tool's `--race-id` flag.

Each race supports `hero_headline`, `hero_subtitle`, and `hero_image` fields that display on the home page hero banner. Articles can be auto-generated from race results using Gemini AI with a single click.
