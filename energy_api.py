# energy_api.py
from flask import Blueprint, jsonify
from tracker import get_live_energy_for_all_cycles

energy_api = Blueprint('energy_api', __name__)

@energy_api.route('/api/live_energy')
def live_energy():
    return jsonify(get_live_energy_for_all_cycles())
# Register the energy API blueprint in app.py