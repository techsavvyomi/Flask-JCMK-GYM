from flask import Blueprint, jsonify
from tracker import get_normal_sessions
from tracker import get_competition_sessions

leaderboard_api = Blueprint('leaderboard_api', __name__)

@leaderboard_api.route('/api/normal_leaderboard')
def normal_leaderboard():
    return jsonify(get_normal_sessions())

@leaderboard_api.route('/api/competition_leaderboard')
def competition_leaderboard():
    return jsonify(get_competition_sessions(competition=True))