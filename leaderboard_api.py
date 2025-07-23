# leaderboard_json.py
from flask import Blueprint, jsonify
from pathlib import Path
import json
from collections import defaultdict
from tracker import get_normal_sessions
from tracker import competition_leaderboard as tracker_comp_lb
import tracker
leaderboard_json = Blueprint('leaderboard_json', __name__)

DATA_DIR = Path(__file__).resolve().parent / "data" / "competitions"

def _energy_from_file(fp: Path) -> dict[str, float]:
    """Return {username: total_energy_wh} for one competition file."""
    with fp.open(encoding="utf-8") as f:
        data = json.load(f)

    # map cycle -> user name
    cycle_to_user = {u["cycle"]: u["name"] for u in data["meta"]["users"]}

    # prefer final_stats if present
    totals = defaultdict(float)
    if data.get("final_stats"):
        for row in data["final_stats"]:
            name = cycle_to_user.get(row["cycle"])
            if name:
                totals[name] += float(row["total_energy_wh"])
        return totals

    # else compute from samples (assumes cumulative Wh in samples)
    max_energy_per_cycle = {}
    for s in data.get("samples", []):
        c = s["cycle"]
        e = float(s.get("energy_wh", 0))
        max_energy_per_cycle[c] = max(max_energy_per_cycle.get(c, 0), e)

    for c, e in max_energy_per_cycle.items():
        name = cycle_to_user.get(c)
        if name:
            totals[name] += e
    return totals

def compute_competition_leaderboard() -> list[dict]:
    scores = defaultdict(float)
    if not DATA_DIR.exists():
        return []

    for fp in DATA_DIR.glob("*_competition.json"):
        try:
            comp_scores = _energy_from_file(fp)
            for name, wh in comp_scores.items():
                scores[name] += wh
        except Exception as e:
            print(f"[LB] skip {fp.name}: {e}")

    return sorted(
        ({"name": n, "total_energy_wh": round(wh, 1)} for n, wh in scores.items()),
        key=lambda x: x["total_energy_wh"],
        reverse=True
        
    )


@leaderboard_json.route("/leaderboard/competition", methods=["GET"])
def competition_lb():
    print("DATA_DIR:", DATA_DIR)
    print("FILES:", [p.name for p in DATA_DIR.glob("*_competition.json")])
    print("LB out:", compute_competition_leaderboard())

    return jsonify(compute_competition_leaderboard())



@leaderboard_json.route("/competitions/list", methods=["GET"])
def list_all_competitions():
    comps = []
    for fp in DATA_DIR.glob("*_competition.json"):
        with fp.open() as f: data = json.load(f)
        comps.append({
          "id": data["meta"]["id"],
          "date": data["meta"]["started_at"][:10],
          "participants": len(data["meta"]["users"]),
          "winner": max(data["final_stats"], key=lambda x: x["total_energy_wh"])["cycle"] if data.get("final_stats") else "-",
          "type": "competition"
        })
    return jsonify(sorted(comps, key=lambda x: x["date"], reverse=True))



@leaderboard_json.route('/api/normal_leaderboard')
def normal_leaderboard():
    return jsonify(get_normal_sessions())

@leaderboard_json.route('/api/competition_leaderboard')
def competition_leaderboard_api():
    return jsonify(tracker.read_competition_csv())  # call a new helper (below)