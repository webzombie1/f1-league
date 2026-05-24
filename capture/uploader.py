"""Upload race results to the F1 League API."""

import json
import os
import requests
from datetime import datetime


def upload_results(api_url, api_key, race_id, results):
    """POST results to the API."""
    url = f"{api_url}/api/admin/races/{race_id}/results"
    headers = {
        'Content-Type': 'application/json',
        'X-API-Key': api_key,
    }
    payload = {'results': results}

    print(f"\nUploading {len(results)} results to {url}...")
    resp = requests.post(url, json=payload, headers=headers, timeout=30)

    if resp.ok:
        data = resp.json()
        print(f"Upload successful: {data.get('results_count', 0)} results saved.")
        if data.get('unmatched_drivers'):
            print(f"Warning: {len(data['unmatched_drivers'])} unmatched drivers:")
            for name in data['unmatched_drivers']:
                print(f"  - {name}")
        return True
    else:
        print(f"Upload failed ({resp.status_code}): {resp.text}")
        return False


def save_to_file(race_id, results, extra=None, label=''):
    """Save results to a local JSON file. `extra` (optional dict) is
    merged into the top-level payload — used to ship participant data
    alongside results so manual recovery has the full picture.

    `label` becomes a filename suffix (e.g. 'raw') so a successful run
    can keep both an upload-shaped file and a debug sidecar."""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    suffix = f"_{label}" if label else ''
    filename = f"results_race_{race_id}_{timestamp}{suffix}.json"

    payload = {'race_id': race_id, 'results': results}
    if extra:
        payload.update(extra)
    with open(filename, 'w') as f:
        json.dump(payload, f, indent=2, default=str)

    print(f"\nResults saved to {filename}")
    return filename
