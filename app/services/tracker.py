import csv
import os
import time
from datetime import datetime
from flask import jsonify
from app.config import Config

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
        self.filename = Config.DATA_DIR / f"{mode}_sessions.csv"

        if not self.filename.exists():
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
        avg_current = 1.0  # Placeholder current
        energy_kwh = (avg_voltage * avg_current * duration) / 3600

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
    filename = Config.DATA_DIR / 'normal_sessions.csv'
    records = []
    if not filename.exists():
        return records
    try:
        with open(filename, newline='') as f:
            reader = csv.reader(f)
            # Check if there's a header
            first_row = next(reader, None)
            if first_row and not first_row[0].lower().startswith("timestamp"):
                 # It's actual data
                 _add_record(records, first_row)
            
            for row in reader:
                _add_record(records, row)
    except Exception as e:
        print(f"[Tracker] Error reading normal sessions CSV: {e}")
    return records

def _add_record(records, row):
    try:
        records.append({
            "timestamp": row[0],
            "cycle": row[1],
            "name": row[2],
            "start": row[3],
            "end": row[4],
            "duration": f"{int(row[5])//60:02}:{int(row[5])%60:02}",
            "energy": f"{float(row[6])*1000:.1f} Wh"
        })
    except (IndexError, ValueError):
        pass

def read_competition_csv():
    path = Config.DATA_DIR / 'competition_sessions.csv'
    out = []
    if not path.exists():
        return out

    with open(path, newline='') as f:
        reader = csv.reader(f)
        first = next(reader, None)
        if first is None:
            return out
        has_header = first[0].lower().startswith("timestamp")
        rows = reader if has_header else [first] + list(reader)

        for r in rows:
            try:
                ts, cycle, student, start, end, dur_s, energy_kwh = r
                dur_s = int(dur_s)
                energy_wh = float(energy_kwh) * 1000.0
                nice_ts = ts.replace('T', ' ').split('.')[0]
                out.append({
                    "timestamp": nice_ts,
                    "cycle": cycle,
                    "name": student,
                    "start": start,
                    "end": end,
                    "duration": f"{dur_s//60:02}:{dur_s%60:02}",
                    "energy": f"{energy_wh:.1f} Wh"
                })
            except Exception as e:
                print("[CSV PARSE]", e, r)
    return out
