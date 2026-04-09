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

    # Open UDP socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(('0.0.0.0', args.port))
    sock.settimeout(1.0)

    print(f"F1 25 Race Capture — listening on port {args.port}")
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

            # ── Participants ──
            if packet_id == PACKET_PARTICIPANTS:
                raw = parse_participants(data)
                participants = {p['index']: p for p in raw}
                human_count = sum(1 for p in raw if p['ai_controlled'] == 0)
                print(f"\rParticipants loaded: {len(raw)} total, {human_count} human", end='', flush=True)

            # ── Event (fastest lap) ──
            elif packet_id == PACKET_EVENT:
                code = parse_event_code(data)
                if code == 'FTLP':
                    fl = parse_fastest_lap_event(data)
                    if fl:
                        fastest_lap = fl
                        driver = participants.get(fl['driver_index'], {})
                        print(f"\n  Fastest lap: {driver.get('name', '?')} — {fl['lap_time_s']:.3f}s")

            # ── Final Classification ──
            elif packet_id == PACKET_FINAL_CLASSIFICATION:
                if session_uid in processed_sessions:
                    continue  # Deduplicate (packet repeats every 5s)
                processed_sessions.add(session_uid)

                print("\n\n=== RACE FINISHED ===\n")

                classification = parse_final_classification(data)

                # Merge with participant data
                results = []
                for entry in classification:
                    idx = entry['index']
                    p = participants.get(idx, {})

                    if entry['status'] in ('invalid', 'inactive'):
                        continue

                    result = {
                        'driver_name': p.get('name', f'Driver_{idx}'),
                        'team_game_id': p.get('team_id', -1),
                        'ai_controlled': p.get('ai_controlled', 1),
                        'position': entry['position'] if entry['status'] == 'finished' else None,
                        'grid_position': entry['grid_position'],
                        'laps_completed': entry['laps_completed'],
                        'status': entry['status'],
                        'status_reason': entry['status_reason'],
                        'best_lap_time_ms': entry['best_lap_time_ms'],
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
                print(f"{'Pos':<5} {'Driver':<25} {'Status':<10} {'Best Lap'}")
                print("-" * 60)
                for r in results:
                    pos = str(r['position']) if r['position'] else r['status'].upper()
                    best = f"{r['best_lap_time_ms'] / 1000:.3f}s" if r['best_lap_time_ms'] else '-'
                    print(f"{pos:<5} {r['driver_name']:<25} {r['status']:<10} {best}")

                # Upload or save
                if args.output == 'api':
                    success = upload_results(args.api_url, args.api_key, args.race_id, results)
                    if not success:
                        print("Falling back to file save...")
                        save_to_file(args.race_id, results)
                else:
                    save_to_file(args.race_id, results)

                print("\nContinuing to listen (Ctrl+C to exit)...")

    except KeyboardInterrupt:
        print("\n\nCapture stopped.")
    finally:
        sock.close()


if __name__ == '__main__':
    main()
