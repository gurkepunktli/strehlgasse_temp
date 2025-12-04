#!/usr/bin/env python3

"""

Zigbee Temperatur-Sensor Monitor fÃ¼r Raspberry Pi

Verbindet sich mit Zigbee2MQTT und sendet Daten an Cloudflare Workers API

UnterstÃ¼tzt alle Zigbee-Temperatursensoren Ã¼ber MQTT

"""



import time

import requests

import json

import logging

from datetime import datetime

import paho.mqtt.client as mqtt



# ===== KONFIGURATION =====

API_URL = "https://temperature-api.dyntech.workers.dev/api/temperature"

LOCATION = "strehlgasse"



# MQTT Konfiguration (Zigbee2MQTT)

MQTT_BROKER = "localhost"

MQTT_PORT = 1883

MQTT_USER = None  # Optional, falls Auth aktiviert

MQTT_PASSWORD = None  # Optional, falls Auth aktiviert

MQTT_TOPIC = "zigbee2mqtt/#"  # Abonniere alle Zigbee-GerÃ¤te



# Sensor-Device Name (wie in Zigbee2MQTT konfiguriert)

SENSOR_DEVICE_NAME = "temperature_sensor"  # Passe dies an deinen GerÃ¤tenamen an



# Logging konfigurieren

logging.basicConfig(

    level=logging.INFO,

    format='%(asctime)s - %(levelname)s - %(message)s',

    handlers=[

        logging.FileHandler('/var/log/zigbee_temp_monitor.log'),

        logging.StreamHandler()

    ]

)



logger = logging.getLogger(__name__)







def send_to_api(temperature, humidity=None):
    """Sendet jedes empfangene Temperatur-/Feuchtigkeits-Update an die Cloudflare Workers API"""
    try:
        current_time = time.time()

        payload = {
            "temperature": round(temperature, 1),
            "location": LOCATION,
            "timestamp": int(current_time * 1000)
        }

        if humidity is not None:
            payload["humidity"] = round(humidity, 1)

        response = requests.post(
            API_URL,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )

        if 200 <= response.status_code < 300:
            logger.info(f"✓ Daten gesendet: {temperature}°C" +
                       (f", {humidity}%" if humidity is not None else "") +
                       f" (HTTP {response.status_code})")
            return True
        else:
            logger.error(f"API Fehler: {response.status_code} - {response.text}")
            return False

    except requests.exceptions.Timeout:
        logger.error(f"⏱️ Timeout: API antwortete nicht innerhalb von 10s")
        return False
    except requests.exceptions.RequestException as e:
        logger.error(f"🌐 Netzwerk-Fehler: {e}")
        return False
    except Exception as e:
        logger.error(f"❌ Fehler beim Senden: {type(e).__name__}: {e}")
        return False


def on_connect(client, userdata, flags, rc):

    """Callback wenn Verbindung zu MQTT Broker hergestellt wurde"""

    if rc == 0:

        logger.info("â Verbunden mit MQTT Broker")

        client.subscribe(MQTT_TOPIC)

        logger.info(f"â Abonniert: {MQTT_TOPIC}")

    else:

        logger.error(f"Verbindung fehlgeschlagen mit Code {rc}")





def on_disconnect(client, userdata, rc):

    """Callback bei Verbindungsabbruch"""

    if rc != 0:

        logger.warning(f"Unerwartete Trennung von MQTT Broker. Code: {rc}")

    else:

        logger.info("Von MQTT Broker getrennt")





def on_message(client, userdata, msg):

    """Callback wenn MQTT Nachricht empfangen wurde"""

    try:

        # Dekodiere Nachricht

        topic = msg.topic

        payload_str = msg.payload.decode('utf-8')



        # Filtere auf das richtige GerÃ¤t

        if not topic.endswith(SENSOR_DEVICE_NAME):

            return



        # Parse JSON Payload

        data = json.loads(payload_str)



        logger.debug(f"Empfangen von {topic}: {payload_str}")



        # Extrahiere Temperatur und Luftfeuchtigkeit

        temperature = None

        humidity = None



        # Verschiedene Formate unterstÃ¼tzen

        if "temperature" in data:

            temperature = float(data["temperature"])



        if "humidity" in data:

            humidity = float(data["humidity"])



        # Sende nur wenn Temperatur vorhanden

        if temperature is not None:

            logger.info(f"ð¡ Sensor-Update: {temperature}Â°C" +

                       (f", {humidity}%" if humidity else ""))

            send_to_api(temperature, humidity)

        else:

            logger.debug(f"Keine Temperaturdaten in Nachricht: {data}")



    except json.JSONDecodeError as e:

        logger.error(f"JSON Parse Fehler: {e}")

    except Exception as e:

        logger.error(f"Fehler bei Nachrichtenverarbeitung: {e}")





def main():

    """Hauptfunktion"""

    logger.info("=" * 60)

    logger.info("Zigbee Temperatur-Monitor gestartet")

    logger.info(f"MQTT Broker: {MQTT_BROKER}:{MQTT_PORT}")

    logger.info(f"Sensor Device: {SENSOR_DEVICE_NAME}")

    logger.info(f"API URL: {API_URL}")

    logger.info(f"Standort: {LOCATION}")

    logger.info("=" * 60)



    # MQTT Client erstellen

    client = mqtt.Client(client_id="zigbee_temp_monitor")



    # Callbacks registrieren

    client.on_connect = on_connect

    client.on_disconnect = on_disconnect

    client.on_message = on_message



    # Optional: Authentifizierung

    if MQTT_USER and MQTT_PASSWORD:

        client.username_pw_set(MQTT_USER, MQTT_PASSWORD)



    try:

        # Verbinde mit MQTT Broker

        logger.info(f"Verbinde mit MQTT Broker {MQTT_BROKER}:{MQTT_PORT}...")

        client.connect(MQTT_BROKER, MQTT_PORT, 60)



        # Starte Loop (blockierend)

        client.loop_forever()



    except KeyboardInterrupt:

        logger.info("Service durch Benutzer beendet")

        client.disconnect()

    except Exception as e:

        logger.error(f"Verbindungsfehler: {e}")

        logger.error("Ist Zigbee2MQTT installiert und lÃ¤uft?")

        logger.error("PrÃ¼fe mit: sudo systemctl status zigbee2mqtt")





if __name__ == "__main__":

    main()

