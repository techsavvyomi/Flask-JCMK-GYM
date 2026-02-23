import requests
import time
import json
import logging
from app.config import Config

logging.basicConfig(level=logging.INFO)

class WifiPoller:
    def __init__(self, esp_ip=None, poll_interval=None):
        self.url = f"http://{esp_ip or Config.ESP_IP}/"
        self.poll_interval = poll_interval or Config.POLL_INTERVAL
        self.data_received = None

    def set_callback(self, callback):
        self.data_received = callback

    def run(self):
        logging.info(f"[WifiPoller] Starting poll loop at {self.url}")
        while True:
            try:
                response = requests.get(self.url, timeout=2)
                if response.status_code == 200:
                    data = response.json()
                    logging.info(f"[WifiPoller] Data received: {data}")
                    if self.data_received:
                        self.data_received(data)
            except Exception as e:
                logging.warning(f"[WifiPoller] Error: {e}")
            time.sleep(self.poll_interval)
