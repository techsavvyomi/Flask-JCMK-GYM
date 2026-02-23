import json
from flask import Blueprint, jsonify
from collections import defaultdict
from app.config import Config
from app.services.tracker import get_normal_sessions, read_competition_csv

leaderboard_api_bp = Blueprint('leaderboard_api', __name__)

def _energy_from_file(fp):
    with fp.open(encoding="utf-8") as f:
        data = json.load(f)

    cycle_to_user = {u["cycle"]: u["name"] for u in data["meta"]["users"]}
    totals = defaultdict(float)
    
    if data.get("final_stats"):
        for row in data["final_stats"]:
            name = cycle_to_user.get(row["cycle"])
            if name:
                totals[name] += float(row["total_energy_wh"])
        return totals

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

def compute_competition_leaderboard():
    scores = defaultdict(float)
    if not Config.COMPETITION_DATA_DIR.exists():
        return []

    for fp in Config.COMPETITION_DATA_DIR.glob("*_competition.json"):
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

@leaderboard_api_bp.route("/competition", methods=["GET"])
def competition_lb():
    return jsonify(compute_competition_leaderboard())

@leaderboard_api_bp.route("/list", methods=["GET"])
def list_all_competitions():
    comps = []
    if not Config.COMPETITION_DATA_DIR.exists():
        return jsonify([])
        
    for fp in Config.COMPETITION_DATA_DIR.glob("*_competition.json"):
        with fp.open() as f:
            data = json.load(f)
        comps.append({
          "id": data["meta"]["id"],
          "date": data["meta"]["started_at"][:10],
          "participants": len(data["meta"]["users"]),
          "winner": max(data["final_stats"], key=lambda x: x["total_energy_wh"])["cycle"] if data.get("final_stats") else "-",
          "type": "competition"
        })
    return jsonify(sorted(comps, key=lambda x: x["date"], reverse=True))

@leaderboard_api_bp.route('/normal_leaderboard')
def normal_leaderboard():
    return jsonify(get_normal_sessions())

@leaderboard_api_bp.route('/competition_leaderboard')
def competition_leaderboard_api():
    return jsonify(read_competition_csv())
