# competition_api.py
import json, time, os
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify

competition_api = Blueprint("competition_api", __name__)
# competition_api.py (top)
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data" / "competitions"
DATA_DIR.mkdir(parents=True, exist_ok=True)

DATA_DIR = "data/competitions"
os.makedirs(DATA_DIR, exist_ok=True)

current_comp = {
    "id": None,
    "path": None,
    "samples": [],      # buffer before flush
    "started_at": None,
    "duration_sec": 0,
    "users": [],
    "cycles": []
}

FLUSH_EVERY = 5  # seconds
_last_flush = 0

def _utcnow():
    return datetime.now(timezone.utc).isoformat()

def _write_json(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2)

def _append_samples(path, samples):
    # store samples inside main file OR in a separate file
    with open(path, "r+", encoding="utf-8") as f:
        data = json.load(f)
        data["samples"].extend(samples)
        f.seek(0)
        json.dump(data, f, indent=2)
        f.truncate()

@competition_api.route("/api/competition/start", methods=["POST"])
def start_competition():
    global current_comp, _last_flush
    payload = request.get_json(force=True) or {}
    duration_sec = int(payload.get("duration_sec", 300))
    users = payload.get("users", [])   # [{id,name,cycle}, ...]
    cycles = [u["cycle"] for u in users]
    print(f"[DEBUG] Starting competition with users: {users}")
    print(f"[DEBUG] Cycles: {cycles}")
    print(f"[DEBUG] Duration: {duration_sec} seconds")

    comp_id = datetime.utcnow().strftime("%Y-%m-%dT%H-%M-%SZ")
    path = os.path.join(DATA_DIR, f"{comp_id}_competition.json")
    current_comp["path"] = str(path)
    current_comp.update({
        "id": comp_id,
        "path": path,
        "samples": [],
        "started_at": _utcnow(),
        "duration_sec": duration_sec,
        "users": users,
        "cycles": cycles
    })
    print(f"[DEBUG] Current competition state: {current_comp}")
    _last_flush = time.time()
    print(f"[DEBUG] _last_flush: {_last_flush}")
    base = {
        "meta": {
            "id": comp_id,
            "started_at": current_comp["started_at"],
            "stopped_at": None,
            "duration_sec": duration_sec,
            "cycles": cycles,
            "users": users
        },
        "samples": [],
        "final_stats": None
    }
    _write_json(path, base)
    print(f"[DEBUG] Competition started with ID: {comp_id}")
    return jsonify({"ok": True, "id": comp_id})

@competition_api.route("/api/competition/sample", methods=["POST"])
def push_sample():
    """Called every second (or N seconds) with energy readings for each active cycle."""
    global _last_flush
    if not current_comp["id"]:
        return jsonify({"error": "no active competition"}), 400

    payload = request.get_json(force=True) or {}
    # payload = {"t": elapsed_seconds, "readings": [{"cycle":1,"energy_wh":12.3}, ...]}
    t = int(payload.get("t", 0))
    readings = payload.get("readings", [])

    # add timestamp server-side too
    now_iso = _utcnow()
    for r in readings:
        r["t"] = t
        r["ts"] = now_iso
        current_comp["samples"].append(r)

    # flush occasionally
    if time.time() - _last_flush >= FLUSH_EVERY:
        _append_samples(current_comp["path"], current_comp["samples"])
        current_comp["samples"].clear()
        _last_flush = time.time()

    return jsonify({"ok": True})

@competition_api.route("/api/competition/stop", methods=["POST"])
def stop_competition():
    if not current_comp["id"]:
        return jsonify({"error": "no active competition"}), 400

    # flush remaining
    if current_comp["samples"]:
        _append_samples(current_comp["path"], current_comp["samples"])
        current_comp["samples"].clear()

    # compute final stats (simple example)
    with open(current_comp["path"], encoding="utf-8") as f:
        data = json.load(f)

    totals = {}
    for s in data["samples"]:
        c = s["cycle"]
        totals.setdefault(c, 0.0)
        totals[c] = max(totals[c], s["energy_wh"])  # assuming cumulative

    data["meta"]["stopped_at"] = _utcnow()
    data["final_stats"] = [{"cycle": c, "total_energy_wh": e} for c, e in totals.items()]

    _write_json(current_comp["path"], data)

    # reset in-memory
    comp_id = current_comp["id"]
    current_comp.update({"id": None, "path": None, "samples": [], "users": [], "cycles": []})

    return jsonify({"ok": True, "id": comp_id, "final_stats": data["final_stats"]})
