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


def save_to_file(race_id, results):
    """Save results to a local JSON file as fallback."""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"results_race_{race_id}_{timestamp}.json"

    with open(filename, 'w') as f:
        json.dump({'race_id': race_id, 'results': results}, f, indent=2)

    print(f"\nResults saved to {filename}")
    return filename
