# tracker.py
import csv
import os
import time
from datetime import datetime
from flask import jsonify

active_sessions = {}  # Maps cycle_id to FlaskSessionTracker

class FlaskSessionTracker:
    def __init__(self, student, cycle_id, mode='normal'):
        self.student = student
        self.cycle_id = cycle_id
        self.mode = mode
        self.running = False
        self.start_time = None
        self.total_voltage = 0.0
        self.voltage_samples = 0
        self.filename = f"data/{mode}_sessions.csv"

        if not os.path.exists(self.filename):
            with open(self.filename, "w", newline='') as f:
                writer = csv.writer(f)
                writer.writerow(["Timestamp", "Cycle", "Student", "Start", "End", "Duration (s)", "Energy (kWh)"])

    def start(self):
        self.running = True
        self.start_time = time.time()
        self.total_voltage = 0.0
        self.voltage_samples = 0

    def update_voltage(self, voltage):
        if self.running:
            self.total_voltage += voltage
            self.voltage_samples += 1

    def stop(self):
        if not self.running:
            return

        end_time = time.time()
        duration = end_time - self.start_time
        avg_voltage = self.total_voltage / self.voltage_samples if self.voltage_samples else 0
        avg_current = 0.5
        energy_kwh = (avg_voltage * 0.5 * duration) / 3600

        try:
            with open(self.filename, "a", newline='') as f:
                writer = csv.writer(f)
                writer.writerow([
                    datetime.now().isoformat(),
                    self.cycle_id,
                    self.student,
                    datetime.fromtimestamp(self.start_time).strftime("%Y-%m-%d %H:%M:%S"),
                    datetime.fromtimestamp(end_time).strftime("%Y-%m-%d %H:%M:%S"),
                    int(duration),
                    f"{energy_kwh:.3f}"
                ])
        except Exception as e:
            print(f"[Tracker] Error writing to file: {e}")

        self.running = False
        self.total_voltage = 0
        self.voltage_samples = 0

    def get_live_energy(self):
        if not self.running:
            return 0.0
        elapsed = time.time() - self.start_time
        avg_voltage = self.total_voltage / self.voltage_samples if self.voltage_samples else 0
        avg_current = 1.0
        return (avg_voltage * avg_current * elapsed) / 3600

def register_session(mode, name, cycle):
    tracker = FlaskSessionTracker(student=name, cycle_id=cycle, mode=mode)
    tracker.start()
    active_sessions[cycle] = tracker

def stop_session(cycle):
    tracker = active_sessions.get(cycle)
    if tracker:
        tracker.stop()
        del active_sessions[cycle]

def log_data(data_list):
    for entry in data_list:
        cycle_id = str(entry.get("cycle"))
        voltage = float(entry.get("voltage", 0))
        tracker = active_sessions.get(cycle_id)
        if tracker:
            tracker.update_voltage(voltage)

def get_live_energy_for_all_cycles():
    result = {}
    for cycle_id, tracker in active_sessions.items():
        result[str(cycle_id)] = {
            "energy": round(tracker.get_live_energy(), 2)
        }
    return result           
def get_normal_sessions():
    filename = 'data/normal_sessions.csv'
    records = []
    try:
        with open(filename, newline='') as f:
            reader = csv.reader(f)
            for row in reader:
                # Do NOT skip first row, since there is NO header!
                records.append({
                    "timestamp": row[0],
                    "cycle": row[1],
                    "name": row[2],
                    "start": row[3],
                    "end": row[4],
                    "duration": f"{int(row[5])//60:02}:{int(row[5])%60:02}",
                    "energy": f"{float(row[6])*1000:.2f} Wh"
                })
    except Exception as e:
        print(f"[Tracker] Error reading CSV: {e}")
    return records

def competition_leaderboard():
    records = []
    data_file = 'data/competition_sessions.csv'
    
    # Create data directory if it doesn't exist
    os.makedirs('data', exist_ok=True)
    
    # Create empty file if it doesn't exist
    if not os.path.exists(data_file):
        with open(data_file, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["Timestamp", "Cycle", "Student", "Start", "End", "Duration (s)", "Energy (kWh)"])
        return jsonify(records)

    try:
        with open(data_file, 'r', newline='') as f:
            # Check if file is empty
            if os.path.getsize(data_file) == 0:
                return jsonify(records)
                
            reader = csv.DictReader(f)
            if not reader.fieldnames:  # If no headers
                return jsonify(records)
                
            for row in reader:
                try:
                    if not row:  # Skip empty rows
                        continue
                    records.append({
                        "name": row.get("Student", row.get("name", "Unknown")),
                        "duration": row.get("Duration (s)", row.get("duration", "0")),
                        "timestamp": row.get("Timestamp", row.get("timestamp", "")),
                        "energy": row.get("Energy (kWh)", row.get("energy", "0"))
                    })
                except Exception as row_error:
                    print(f"[Leaderboard] Error processing row: {row}, Error: {row_error}")
                    continue
                    
    except Exception as e:
        print(f"[Leaderboard] Error reading {data_file}: {e}")
        import traceback
        traceback.print_exc()
    
    return jsonify(records)
