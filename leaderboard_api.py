from flask import Blueprint, jsonify
from tracker import get_normal_sessions
from tracker import competition_leaderboard

leaderboard_api = Blueprint('leaderboard_api', __name__)

@leaderboard_api.route('/api/normal_leaderboard')
def normal_leaderboard():
    return jsonify(get_normal_sessions())

@leaderboard_api.route('/api/competition_leaderboard')
def competition_leaderboard():
    try:
        from tracker import competition_leaderboard as get_competition_data
        data = get_competition_data()
        return jsonify(data)
    except Exception as e:
        import traceback
        print(f"Error in competition_leaderboard: {e}")
        print(traceback.format_exc())
        return jsonify({"error": "Internal server error", "details": str(e)}), 500
