from flask import Blueprint, jsonify
from tracker import get_normal_sessions

leaderboard_api = Blueprint('leaderboard_api', __name__)

@leaderboard_api.route('/api/normal_leaderboard')
def normal_leaderboard():
    return jsonify(get_normal_sessions())