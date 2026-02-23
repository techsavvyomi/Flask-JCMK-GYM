import json
import time
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from app.config import Config

competition_api_bp = Blueprint("competition_api", __name__)

current_comp = {
    "id": None,
    "path": None,
    "samples": [],
    "started_at": None,
    "duration_sec": 0,
    "users": [],
    "cycles": []
}

_last_flush = 0

def _utcnow():
    return datetime.now(timezone.utc).isoformat()

def _write_json(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2)

def _append_samples(path, samples):
    with open(path, "r+", encoding="utf-8") as f:
        data = json.load(f)
        data["samples"].extend(samples)
        f.seek(0)
        json.dump(data, f, indent=2)
        f.truncate()

@competition_api_bp.route("/start", methods=["POST"])
def start_competition():
    global current_comp, _last_flush
    payload = request.get_json(force=True) or {}
    duration_sec = int(payload.get("duration_sec", 300))
    users = payload.get("users", [])
    cycles = [u["cycle"] for u in users]

    comp_id = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")
    path = Config.COMPETITION_DATA_DIR / f"{comp_id}_competition.json"
    
    current_comp.update({
        "id": comp_id,
        "path": path,
        "samples": [],
        "started_at": _utcnow(),
        "duration_sec": duration_sec,
        "users": users,
        "cycles": cycles
    })
    
    _last_flush = time.time()
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
    return jsonify({"ok": True, "id": comp_id})

@competition_api_bp.route("/sample", methods=["POST"])
def push_sample():
    global _last_flush
    if not current_comp["id"]:
        return jsonify({"error": "no active competition"}), 400

    payload = request.get_json(force=True) or {}
    t = int(payload.get("t", 0))
    readings = payload.get("readings", [])

    now_iso = _utcnow()
    for r in readings:
        r["t"] = t
        r["ts"] = now_iso
        current_comp["samples"].append(r)

    if time.time() - _last_flush >= Config.FLUSH_EVERY:
        _append_samples(current_comp["path"], current_comp["samples"])
        current_comp["samples"].clear()
        _last_flush = time.time()

    return jsonify({"ok": True})

@competition_api_bp.route("/stop", methods=["POST"])
def stop_competition():
    if not current_comp["id"]:
        return jsonify({"error": "no active competition"}), 400

    if current_comp["samples"]:
        _append_samples(current_comp["path"], current_comp["samples"])
        current_comp["samples"].clear()

    with open(current_comp["path"], encoding="utf-8") as f:
        data = json.load(f)

    totals = {}
    for s in data["samples"]:
        c = s["cycle"]
        totals.setdefault(c, 0.0)
        totals[c] = max(totals[c], s["energy_wh"])

    data["meta"]["stopped_at"] = _utcnow()
    data["final_stats"] = [{"cycle": c, "total_energy_wh": e} for c, e in totals.items()]

    _write_json(current_comp["path"], data)

    comp_id = current_comp["id"]
    current_comp.update({"id": None, "path": None, "samples": [], "users": [], "cycles": []})

    return jsonify({"ok": True, "id": comp_id, "final_stats": data["final_stats"]})
