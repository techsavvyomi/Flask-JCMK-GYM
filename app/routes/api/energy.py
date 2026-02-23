from flask import Blueprint, jsonify
from app.services.tracker import get_live_energy_for_all_cycles

energy_api_bp = Blueprint('energy_api', __name__)

@energy_api_bp.route('/live_energy')
def live_energy():
    return jsonify(get_live_energy_for_all_cycles())
