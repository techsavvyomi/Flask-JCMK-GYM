from flask import Blueprint, request, jsonify
from tracker import register_session, stop_session

register_api = Blueprint('register_api', __name__)

@register_api.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    name = data.get("name")
    cycle = data.get("cycle")
    mode = data.get("mode", "normal")

    if not name or not cycle:
        return jsonify({"error": "Missing name or cycle"}), 400

    register_session(mode, name, str(cycle))
    return jsonify({"status": "registered"}), 200

@register_api.route('/api/stop', methods=['POST'])
def stop():
    data = request.get_json()
    cycle = data.get("cycle")

    if not cycle:
        return jsonify({"error": "Missing cycle"}), 400

    stop_session(str(cycle))
    return jsonify({"status": "stopped"}), 200
