import threading
from flask import Flask
from app.config import Config
from app.routes.ui import ui_bp
from app.routes.api.register import register_api_bp
from app.routes.api.leaderboard import leaderboard_api_bp
from app.routes.api.energy import energy_api_bp
from app.routes.api.competition import competition_api_bp
from app.services.tracker import log_data
from app.services.wifi_listener import WifiPoller

def create_app(config_class=Config):
    app = Flask(__name__, template_folder='../templates', static_folder='../static')
    app.config.from_object(config_class)
    
    config_class.init_app(app)

    # Let's adjust prefixes to match original expected URLs to avoid breaking frontend
    app.register_blueprint(ui_bp)
    app.register_blueprint(register_api_bp) # /api/register, /api/stop
    app.register_blueprint(leaderboard_api_bp) # /leaderboard/competition, /competitions/list, etc.
    app.register_blueprint(energy_api_bp, url_prefix='/api') # /api/live_energy
    app.register_blueprint(competition_api_bp, url_prefix='/api/competition') # /api/competition/start, etc.

    # Start WifiPoller in a background thread
    def handle_data(data):
        try:
            if not isinstance(data, dict) or "channels" not in data:
                return

            entries = data["channels"]
            valid_entries = []

            for entry in entries:
                if entry.get("connected") != 1:
                    continue

                try:
                    cleaned = {
                        "cycle": entry["channel"] + 1,
                        "voltage": entry["voltage_mV"] / 1000,
                        "current": abs(entry["current_mA"] / 1000),
                        "power": entry["power_mW"] / 1000,
                    }
                    valid_entries.append(cleaned)
                except Exception as e:
                    print(f"[WifiPoller] Data conversion failed: {e}")

            if valid_entries:
                log_data(valid_entries)
        except Exception as e:
            print(f"[WifiPoller] Exception in handle_data: {e}")

    poller = WifiPoller()
    poller.set_callback(handle_data)
    poller_thread = threading.Thread(target=poller.run, daemon=True)
    poller_thread.start()

    return app
