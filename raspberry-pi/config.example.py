# Konfiguration für Zigbee Temperatur-Monitor
# Kopiere diese Datei nach config.py und passe die Werte an

# API URL (deine Cloudflare Worker URL)
API_URL = "https://temperature-api.dyntech.workers.dev/api/temperature"

# Standort-Name
LOCATION = "strehlgasse"

# MQTT / Zigbee2MQTT Konfiguration
MQTT_BROKER = "localhost"
MQTT_PORT = 1883
MQTT_USER = None  # Optional, falls Auth aktiviert
MQTT_PASSWORD = None  # Optional, falls Auth aktiviert

# Sensor Device Name (wie in Zigbee2MQTT konfiguriert)
# Finde den Namen mit: mosquitto_sub -t "zigbee2mqtt/#" -v
SENSOR_DEVICE_NAME = "temperature_sensor"

# Minimum Intervall zwischen API-Calls (Sekunden)
MIN_SEND_INTERVAL = 30
