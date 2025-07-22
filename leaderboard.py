from flask import Blueprint, jsonify
import csv
from collections import defaultdict

leaderboard_blueprint = Blueprint('leaderboard', __name__)

def compute_leaderboard(file_path):
    scores = defaultdict(float)
    with open(file_path, newline='') as f:
        reader = csv.reader(f)
        for row in reader:
            try:
                # Skip header if present
                if row[0] == "Timestamp":
                    continue
                name = row[2]
                energy_kwh = float(row[6])
                scores[name] += energy_kwh * 1000  # convert kWh to Wh
            except Exception as e:
                print(f"[Leaderboard] Skipped row: {row} ({e})")
                continue
    # Convert to list of dicts for nicer API output
    sorted_scores = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [{"name": n, "energy_wh": round(e,1)} for n, e in sorted_scores]

@leaderboard_blueprint.route('/leaderboard/normal', methods=['GET'])
def normal_leaderboard():
    return jsonify(compute_leaderboard('data/normal_sessions.csv'))

@leaderboard_blueprint.route('/leaderboard/competition', methods=['GET'])
def competition_leaderboard():
    return jsonify(compute_leaderboard('data/competition_sessions.csv'))
