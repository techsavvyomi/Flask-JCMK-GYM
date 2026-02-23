from flask import Blueprint, request, jsonify
from app.services.tracker import register_session, stop_session

register_api_bp = Blueprint('register_api', __name__)

@register_api_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    name = data.get("name")
    cycle = data.get("cycle")
    mode = data.get("mode", "normal")

    if not name or not cycle:
        return jsonify({"error": "Missing name or cycle"}), 400

    register_session(mode, name, str(cycle))
    return jsonify({"status": "registered"}), 200

@register_api_bp.route('/stop', methods=['POST'])
def stop():
    data = request.get_json()
    cycle = data.get("cycle")

    if not cycle:
        return jsonify({"error": "Missing cycle"}), 400

    stop_session(str(cycle))
    return jsonify({"status": "stopped"}), 200
