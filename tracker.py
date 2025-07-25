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
        avg_current = 1.0
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
        self.total_voltage = 0
        self.voltage_samples = 0

    def get_live_energy(self):
        print(f"[DEBUG] Getting live energy for cycle {self.cycle_id} - Running: {self.running}")
        print(f"[DEBUG] Total voltage: {self.total_voltage}, Samples: {self.voltage_samples}")
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
    print("\n[DEBUG] Generating live energy report...")
    print(f"Active sessions: {list(active_sessions.keys())}")
    result = {}
    for cycle_id, tracker in active_sessions.items():
        print(f"Cycle {cycle_id} - Running: {tracker.running}")
        print(f"Voltage: {tracker.total_voltage}, Samples: {tracker.voltage_samples}")
        print(f"Energy: {tracker.get_live_energy()}")

        result[str(cycle_id)] = {
            "energy": round(tracker.get_live_energy(), 2)
        }
    print(f"\n[DEBUG] Final result: {result}")
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
                    "energy": f"{float(row[6])*1000:.1f} Wh"
                })
    except Exception as e:
        print(f"[Tracker] Error reading CSV: {e}")
    return records

def get_competition_sessions(competition=True):
    filename = 'data/competition_sessions.csv'
    records = []
    try:
        with open(filename, newline='') as f:
            reader = csv.reader(f)
            next(reader, None)  # skip header
            for row in reader:
                duration = row[2]
                energy = float(row[4])
                records.append({
                    "timestamp": row[5],
                    "cycle": row[3],
                    "name": row[0],
                    "duration": duration,
                    "energy": f"{energy:.1f} Wh"
                })
    except Exception as e:
        print(f"[Competition] Error reading CSV: {e}")
    return records


def competition_leaderboard():
    records = []

    if not os.path.exists('data/competition_sessions.csv'):
        return jsonify([])

    try:
        with open('data/competition_sessions.csv', newline='') as f:
            reader = csv.DictReader(f)
            for row in reader:
                duration_sec = int(row["Duration (s)"])
                energy_wh = float(row["Energy (kWh)"]) * 1000
                records.append({
                    "name": row["Student"],
                    "cycle": row["Cycle"],
                    "duration": f"{duration_sec//60:02}:{duration_sec%60:02}",
                    "timestamp": row["Timestamp"],
                    "energy": f"{energy_wh:.1f} Wh"
                })
    except Exception as e:
        print(f"[Leaderboard API] Error reading CSV: {e}")
    
    return jsonify(records)


def read_competition_csv():
    path = 'data/competition_sessions.csv'
    out = []
    if not os.path.exists(path):
        return out

    with open(path, newline='') as f:
        reader = csv.reader(f)
        first = next(reader, None)
        if first is None:
            return out
        has_header = first and first[0].lower().startswith("timestamp")
        rows = reader if has_header else [first] + list(reader)

        for r in rows:
            try:
                ts, cycle, student, start, end, dur_s, energy_kwh = r
                dur_s = int(dur_s)
                energy_wh = float(energy_kwh) * 1000.0

                # --- format the date here ---
                # keep the original if you still want it
                nice_ts = ts.replace('T', ' ').split('.')[0]   # "2025-07-22 16:36:59"
                # or if you only want YYYY-MM-DD:
                # nice_ts = ts.split('T')[0]

                out.append({
                    "timestamp": nice_ts,          # same key the UI expects
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
