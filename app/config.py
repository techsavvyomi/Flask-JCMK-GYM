import os
from pathlib import Path

class Config:
    # Flask settings
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
    DEBUG = os.getenv("FLASK_DEBUG", "True").lower() in ("true", "1", "t")
    PORT = int(os.getenv("PORT", 8080))

    # ESP32 settings
    ESP_IP = os.getenv("ESP_IP", "192.168.4.1")
    POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", 2))

    # Paths
    BASE_DIR = Path(__file__).resolve().parent.parent
    DATA_DIR = Path(os.getenv("DATA_DIR", "data"))
    COMPETITION_DATA_DIR = Path(os.getenv("COMPETITION_DATA_DIR", "data/competitions"))
    
    # Competition settings
    FLUSH_EVERY = int(os.getenv("FLUSH_EVERY", 5))

    @classmethod
    def init_app(cls, app):
        # Create necessary directories
        cls.DATA_DIR.mkdir(parents=True, exist_ok=True)
        cls.COMPETITION_DATA_DIR.mkdir(parents=True, exist_ok=True)
