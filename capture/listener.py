"""F1 25 UDP race capture tool.

Listens for race data from F1 25 on port 20777 and uploads
results to the F1 League Tracker API when the race ends.

Usage:
    python listener.py --race-id 3 --api-url https://your-app.fly.dev --api-key YOUR_KEY
    python listener.py --race-id 3 --output file
"""

import argparse
import socket
import sys

from packets import (
    parse_header,
    parse_participants,
    parse_final_classification,
    parse_event_code,
    parse_fastest_lap_event,
    parse_session_data,
    is_quali_session,
    is_race_session,
    SESSION_TYPE_NAMES,
    PACKET_SESSION,
    PACKET_PARTICIPANTS,
    PACKET_FINAL_CLASSIFICATION,
    PACKET_EVENT,
)
from uploader import upload_results, save_to_file

PORT = 20777
BUFFER_SIZE = 2048


def calculate_gaps(results):
    """Calculate gap to leader for each result."""
    if not results:
        return results

    leader = results[0]
    leader_time = leader.get('total_time_s')

    for r in results:
        if r is leader:
            r['gap_to_leader'] = ''
            continue

        if r['status'] != 'finished':
            r['gap_to_leader'] = r['status'].upper()
            continue

        if leader_time and r.get('total_time_s'):
            if r['laps_completed'] < leader.get('laps_completed', 0):
                lap_diff = leader['laps_completed'] - r['laps_completed']
                r['gap_to_leader'] = f"+{lap_diff} Lap{'s' if lap_diff > 1 else ''}"
            else:
                gap = r['total_time_s'] + r.get('penalties_time_s', 0) - leader_time
                r['gap_to_leader'] = f"+{gap:.3f}"
        else:
            r['gap_to_leader'] = ''

    return results


def main():
    parser = argparse.ArgumentParser(description='F1 25 Race Capture Tool')
    parser.add_argument('--race-id', type=int, required=True, help='Race ID to submit results for')
    parser.add_argument('--api-url', type=str, default='http://localhost:8000', help='API base URL')
    parser.add_argument('--api-key', type=str, default='', help='API key for authentication')
    parser.add_argument('--output', type=str, choices=['api', 'file'], default='api', help='Output mode')
    parser.add_argument('--port', type=int, default=PORT, help='UDP port to listen on')
    args = parser.parse_args()

    # State
    participants = {}  # index -> participant data
    fastest_lap = None  # {driver_index, lap_time_s}
    processed_sessions = set()  # session UIDs we've already processed
    participants_dumped = False  # only dump the roster once per session
    current_session_type = None  # latest m_sessionType from SessionData
    current_session_label = '?'  # human-friendly name for printing
    last_session_logged = None   # only print the session banner once per change
    # driver_name -> best lap time in ms, snapshot from the most recent
    # qualifying session. Carried forward and attached to race results
    # when the race finishes.
    quali_times = {}

    # Open UDP socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(('0.0.0.0', args.port))
    sock.settimeout(1.0)

    print(f"F1 25 Race Capture - listening on port {args.port}")
    print(f"Race ID: {args.race_id}")
    print(f"Output: {args.output}")
    print("Waiting for race data...\n")

    try:
        while True:
            try:
                data, addr = sock.recvfrom(BUFFER_SIZE)
            except socket.timeout:
                continue

            if len(data) < 30:
                continue

            header = parse_header(data)
            packet_id = header['packet_id']
            session_uid = header['session_uid']

            # -- Session (track type so we know quali vs race) --
            if packet_id == PACKET_SESSION:
                sd = parse_session_data(data)
                if sd is not None:
                    current_session_type = sd['session_type']
                    current_session_label = sd['session_type_label']
                    if last_session_logged != current_session_type:
                        print(f"\nSession changed: {current_session_label} (type {current_session_type})")
                        last_session_logged = current_session_type
                continue

            # -- Participants --
            if packet_id == PACKET_PARTICIPANTS:
                raw = parse_participants(data)
                participants = {p['index']: p for p in raw}
                human_count = sum(1 for p in raw if p['ai_controlled'] == 0)
                print(f"\rParticipants loaded: {len(raw)} total, {human_count} human", end='', flush=True)

                # On the first parse, dump every entry so the user can
                # verify names actually came through. If `your_telemetry`
                # is 0 for a human, F1 25 masks the gamer tag at the
                # source - the player must set their telemetry to
                # PUBLIC in-game.
                if not participants_dumped and raw:
                    print()  # newline
                    print(f"{'#':<3} {'AI':<3} {'Tele':<5} {'Plat':<5} {'Team':<5} {'Name'}")
                    print("-" * 70)
                    for p in raw:
                        ai = 'AI' if p['ai_controlled'] else '.'
                        tele = ('PUB' if p['your_telemetry'] == 1
                                else ('AI ' if p['ai_controlled'] else 'PRV'))
                        plat = p.get('platform_label', '?')[:5]
                        team = str(p['team_id'])
                        nm = p['name'] or '(empty)'
                        print(f"{p['index']:<3} {ai:<3} {tele:<5} {plat:<5} {team:<5} {nm}")
                    masked = [p for p in raw if p['ai_controlled'] == 0 and p['your_telemetry'] != 1]
                    if masked:
                        print()
                        print(f"!! {len(masked)} human(s) have telemetry RESTRICTED - names masked at source.")
                        print("   Have them open F1 25 -> Settings -> Telemetry -> 'Your Telemetry: Public'.")
                    participants_dumped = True
                    print()

            # -- Event (fastest lap) --
            elif packet_id == PACKET_EVENT:
                code = parse_event_code(data)
                if code == 'FTLP':
                    fl = parse_fastest_lap_event(data)
                    if fl:
                        fastest_lap = fl
                        driver = participants.get(fl['driver_index'], {})
                        print(f"\n  Fastest lap: {driver.get('name', '?')} - {fl['lap_time_s']:.3f}s")

            # -- Final Classification --
            elif packet_id == PACKET_FINAL_CLASSIFICATION:
                if session_uid in processed_sessions:
                    continue  # Deduplicate (packet repeats every 5s)
                processed_sessions.add(session_uid)

                classification = parse_final_classification(data)
                is_quali = is_quali_session(current_session_type)
                is_race = is_race_session(current_session_type)

                # -- Qualifying: snapshot each driver's best lap as their
                # quali time and stash it in memory. Don't upload.
                if is_quali:
                    print(f"\n\n=== {current_session_label} FINISHED ===\n")
                    snapshot = {}
                    for entry in classification:
                        if entry['status'] in ('invalid', 'inactive'):
                            continue
                        if not entry.get('best_lap_time_ms'):
                            continue
                        p = participants.get(entry['index'], {})
                        name = p.get('name') or f"Driver_{entry['index']}"
                        snapshot[name] = entry['best_lap_time_ms']

                    # Merge into the carried-forward quali_times map.
                    # Keeping the FASTEST seen across Q1/Q2/Q3 means we
                    # don't lose a driver's Q1 best when they don't
                    # progress to Q3.
                    for name, t in snapshot.items():
                        prev = quali_times.get(name)
                        if prev is None or t < prev:
                            quali_times[name] = t

                    print(f"Captured {len(snapshot)} qualifying time(s):")
                    for name, t in sorted(snapshot.items(), key=lambda kv: kv[1]):
                        print(f"  {name:<25} {t / 1000:.3f}s")
                    print("\n(Quali times held in memory; will be attached when the race finishes.)")
                    print("Continuing to listen (Ctrl+C to exit)...")
                    continue

                # -- Anything other than a race: just log and move on.
                if not is_race:
                    label = current_session_label if current_session_type is not None else 'session'
                    print(f"\n\n=== {label} FINISHED (not race, not quali - ignoring) ===\n")
                    print("Continuing to listen (Ctrl+C to exit)...")
                    continue

                # -- Race --
                print("\n\n=== RACE FINISHED ===\n")

                # Merge with participant data
                results = []
                for entry in classification:
                    idx = entry['index']
                    p = participants.get(idx, {})

                    if entry['status'] in ('invalid', 'inactive'):
                        continue

                    name = p.get('name', f'Driver_{idx}')
                    result = {
                        'driver_name': name,
                        'team_game_id': p.get('team_id', -1),
                        'ai_controlled': p.get('ai_controlled', 1),
                        'position': entry['position'] if entry['status'] == 'finished' else None,
                        'grid_position': entry['grid_position'],
                        'laps_completed': entry['laps_completed'],
                        'status': entry['status'],
                        'status_reason': entry['status_reason'],
                        'best_lap_time_ms': entry['best_lap_time_ms'],
                        'quali_time_ms': quali_times.get(name),
                        'total_time_s': entry['total_time_s'],
                        'penalties_time_s': entry['penalties_time_s'],
                        'num_penalties': entry['num_penalties'],
                        'num_pit_stops': entry['num_pit_stops'],
                        'tyre_stints': entry['tyre_stints'],
                    }
                    results.append(result)

                # Sort by position (finished first, then DNFs)
                results.sort(key=lambda r: (0 if r['position'] else 1, r['position'] or 999))

                # Calculate gaps
                results = calculate_gaps(results)

                # Print summary
                attached_quali = sum(1 for r in results if r.get('quali_time_ms'))
                if quali_times:
                    print(f"Attaching {attached_quali} qualifying time(s) "
                          f"from {len(quali_times)} stored in memory.")
                else:
                    print("No qualifying times in memory - race upload will have quali_time_ms=null.")
                print(f"{'Pos':<5} {'Driver':<25} {'Status':<10} {'Best Lap':<12} {'Quali'}")
                print("-" * 75)
                for r in results:
                    pos = str(r['position']) if r['position'] else r['status'].upper()
                    best = f"{r['best_lap_time_ms'] / 1000:.3f}s" if r['best_lap_time_ms'] else '-'
                    quali = f"{r['quali_time_ms'] / 1000:.3f}s" if r.get('quali_time_ms') else '-'
                    print(f"{pos:<5} {r['driver_name']:<25} {r['status']:<10} {best:<12} {quali}")

                # Always write a raw sidecar dump with the full
                # participant + result data - even when the API upload
                # succeeds. Lets you recover from misparsed names /
                # privacy-masked entries after the fact without
                # re-running the race.
                save_to_file(
                    args.race_id, results,
                    extra={
                        'participants': list(participants.values()),
                        'quali_times': quali_times,
                    },
                    label='raw',
                )

                # Upload (or, if file mode, the dump above is the only artifact)
                if args.output == 'api':
                    success = upload_results(args.api_url, args.api_key, args.race_id, results)
                    if not success:
                        print("(API upload failed - raw sidecar already saved.)")

                print("\nContinuing to listen (Ctrl+C to exit)...")

    except KeyboardInterrupt:
        print("\n\nCapture stopped.")
    finally:
        sock.close()


if __name__ == '__main__':
    main()
