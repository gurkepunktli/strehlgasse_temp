#!/usr/bin/env python3
"""
Raspberry Pi Temperatur-Sensor Service
Sendet Temperaturdaten an Cloudflare Workers API
Unterstützt: DHT22, DHT11, DS18B20
"""

import time
import requests
import json
import logging
from datetime import datetime

# ===== KONFIGURATION =====
API_URL = "https://temperature-api.dyntech.workers.dev/api/temperature"
SENSOR_TYPE = "DHT22"  # Optionen: "DHT22", "DHT11", "DS18B20"
SENSOR_PIN = 4         # GPIO Pin für DHT Sensoren
INTERVAL = 60          # Sekunden zwischen Messungen
LOCATION = "strehlgasse"

# Logging konfigurieren
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/temp_sensor.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)


def read_dht_sensor():
    """Liest Temperatur und Luftfeuchtigkeit von DHT22/DHT11 Sensor"""
    try:
        import Adafruit_DHT

        if SENSOR_TYPE == "DHT22":
            sensor = Adafruit_DHT.DHT22
        elif SENSOR_TYPE == "DHT11":
            sensor = Adafruit_DHT.DHT11
        else:
            raise ValueError(f"Unbekannter Sensor-Typ: {SENSOR_TYPE}")

        humidity, temperature = Adafruit_DHT.read_retry(sensor, SENSOR_PIN)

        if humidity is not None and temperature is not None:
            return {
                "temperature": round(temperature, 1),
                "humidity": round(humidity, 1)
            }
        else:
            logger.error("Fehler beim Lesen des DHT Sensors")
            return None

    except ImportError:
        logger.error("Adafruit_DHT Library nicht installiert. Installiere mit: pip3 install Adafruit_DHT")
        return None
    except Exception as e:
        logger.error(f"Fehler beim Lesen des DHT Sensors: {e}")
        return None


def read_ds18b20_sensor():
    """Liest Temperatur von DS18B20 Sensor (1-Wire)"""
    try:
        import glob

        # Finde DS18B20 Sensor
        base_dir = '/sys/bus/w1/devices/'
        device_folder = glob.glob(base_dir + '28*')[0]
        device_file = device_folder + '/w1_slave'

        # Lese Sensor-Daten
        with open(device_file, 'r') as f:
            lines = f.readlines()

        # Parse Temperatur
        if lines[0].strip()[-3:] == 'YES':
            equals_pos = lines[1].find('t=')
            if equals_pos != -1:
                temp_string = lines[1][equals_pos+2:]
                temperature = float(temp_string) / 1000.0
                return {
                    "temperature": round(temperature, 1),
                    "humidity": None
                }

        logger.error("Fehler beim Lesen des DS18B20 Sensors")
        return None

    except FileNotFoundError:
        logger.error("DS18B20 Sensor nicht gefunden. Ist 1-Wire aktiviert?")
        logger.error("Aktiviere mit: sudo raspi-config -> Interface Options -> 1-Wire")
        return None
    except Exception as e:
        logger.error(f"Fehler beim Lesen des DS18B20 Sensors: {e}")
        return None


def read_sensor():
    """Hauptfunktion zum Lesen des Sensors basierend auf Konfiguration"""
    if SENSOR_TYPE in ["DHT22", "DHT11"]:
        return read_dht_sensor()
    elif SENSOR_TYPE == "DS18B20":
        return read_ds18b20_sensor()
    else:
        logger.error(f"Unbekannter Sensor-Typ: {SENSOR_TYPE}")
        return None


def send_to_api(data):
    """Sendet Daten an die Cloudflare Workers API"""
    try:
        payload = {
            "temperature": data["temperature"],
            "location": LOCATION,
            "timestamp": int(time.time() * 1000)
        }

        # Füge Luftfeuchtigkeit hinzu, falls vorhanden
        if data.get("humidity") is not None:
            payload["humidity"] = data["humidity"]

        response = requests.post(
            API_URL,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )

        if response.status_code in [200, 201]:
            logger.info(f"✓ Daten gesendet: {data['temperature']}°C" +
                       (f", {data['humidity']}%" if data.get("humidity") else ""))
            return True
        else:
            logger.error(f"API Fehler: {response.status_code} - {response.text}")
            return False

    except requests.exceptions.RequestException as e:
        logger.error(f"Netzwerk-Fehler: {e}")
        return False
    except Exception as e:
        logger.error(f"Fehler beim Senden der Daten: {e}")
        return False


def main():
    """Hauptschleife"""
    logger.info("=" * 50)
    logger.info("Temperatur-Sensor Service gestartet")
    logger.info(f"Sensor: {SENSOR_TYPE}")
    logger.info(f"Standort: {LOCATION}")
    logger.info(f"Intervall: {INTERVAL} Sekunden")
    logger.info(f"API: {API_URL}")
    logger.info("=" * 50)

    consecutive_errors = 0
    max_errors = 5

    while True:
        try:
            # Sensor auslesen
            data = read_sensor()

            if data is not None:
                # Daten senden
                success = send_to_api(data)

                if success:
                    consecutive_errors = 0
                else:
                    consecutive_errors += 1
            else:
                consecutive_errors += 1

            # Bei zu vielen Fehlern, längere Pause
            if consecutive_errors >= max_errors:
                logger.warning(f"Zu viele Fehler ({consecutive_errors}). Warte 5 Minuten...")
                time.sleep(300)
                consecutive_errors = 0
            else:
                # Normale Wartezeit
                time.sleep(INTERVAL)

        except KeyboardInterrupt:
            logger.info("Service durch Benutzer beendet")
            break
        except Exception as e:
            logger.error(f"Unerwarteter Fehler: {e}")
            time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
