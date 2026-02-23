# Flask-JCMK-GYM

A Flask-based application for tracking and logging gym data (voltage, current, power) from ESP32-connected equipment, featuring both normal logging and competition modes.

## Project Structure

```text
.
├── app/                    # Main application package
│   ├── routes/             # Blueprint routes
│   │   ├── api/            # API endpoints (register, leaderboard, etc.)
│   │   └── ui.py           # User interface routes
│   ├── services/           # Business logic and background tasks
│   │   ├── tracker.py      # Data tracking and CSV logging
│   │   └── wifi_listener.py # ESP32 data polling service
│   ├── config.py           # Centralized configuration
│   └── __init__.py         # App factory and initialization
├── data/                   # Logged data storage (CSV/JSON)
├── static/                 # Static assets (CSS, JS)
├── templates/              # HTML templates
├── run.py                  # Application entry point
├── .env.example            # Example configuration
└── .gitignore              # Git ignore rules
```

## Features

- **Real-time Data Polling**: Background service polls ESP32 for energy data.
- **Normal Mode**: Track and log individual student performance.
- **Competition Mode**: Live leaderboard and session tracking for competitive events.
- **RESTful API**: Endpoints for registration, live data, and leaderboards.
- **Modular Design**: Clean separation of concerns using Flask Blueprints and services.

## Setup Instructions

### 1. Prerequisites
- Python 3.x
- Flask
- Requests

### 2. Installation
Clone the repository:
```bash
git clone https://github.com/techsavvyomi/Flask-JCMK-GYM.git
cd Flask-JCMK-GYM
```

Install dependencies:
```bash
pip install flask requests
```

### 3. Configuration
Copy the example environment file and adjust as needed:
```bash
cp .env.example .env
```
Key settings in `.env`:
- `ESP_IP`: IP address of the ESP32 dispositivo.
- `PORT`: Port to run the Flask server (default: 8080).

### 4. Running the Application
```bash
python run.py
```
The application will be available at `http://localhost:8080`.

## Usage

- **Home (`/`)**: Overview and navigation.
- **Competition (`/competition`)**: Start and manage competitions.
- **Logs (`/normal-log`, `/competition-log`)**: View historical session data.

## License
MIT
