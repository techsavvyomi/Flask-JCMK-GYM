from flask import Flask
from ui import ui_blueprint
from register_api import register_api
from leaderboard_api import leaderboard_api
from energy_api import energy_api
from tracker import log_data
from wifi_listener import WifiPoller
import threading

app = Flask(__name__)

# Register all blueprints
app.register_blueprint(ui_blueprint)
app.register_blueprint(register_api)
app.register_blueprint(leaderboard_api)
app.register_blueprint(energy_api)

# Define the function that WifiPoller will call on receiving data
def handle_data(data):
    try:
        if not isinstance(data, dict) or "channels" not in data:
            print("[WifiPoller] Invalid data format: Expected dict with 'channels' key.")
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
                print(f"[WifiPoller] Data conversion failed: {entry} => {e}")

        if valid_entries:
            log_data(valid_entries)
            print(f"[WifiPoller] Logged {len(valid_entries)} entries.")
        else:
            print("[WifiPoller] No valid entries found.")
    except Exception as e:
        print(f"[WifiPoller] Exception in handle_data: {e}")

# Start WifiPoller in a background thread
poller = WifiPoller()
poller.set_callback(handle_data)
poller_thread = threading.Thread(target=poller.run, daemon=True)
poller_thread.start()

if __name__ == "__main__":
    app.run(port=8080, debug=True)
