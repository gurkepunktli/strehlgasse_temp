#!/bin/bash
###############################################################################
# Installation-Skript für Raspberry Pi Zigbee Temperatur-Monitor
# Setzt Zigbee2MQTT und den Monitor-Service auf
###############################################################################

set -e

echo "=============================================="
echo "Zigbee Temperatur-Monitor Installation"
echo "=============================================="
echo ""

# Farben
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Prüfe Root
if [ "$EUID" -eq 0 ]; then
    echo -e "${RED}Bitte NICHT als root ausführen!${NC}"
    echo "Verwende: ./install_zigbee.sh"
    exit 1
fi

INSTALL_DIR="$HOME/temperature-sensor"

echo -e "${GREEN}1. System-Pakete aktualisieren...${NC}"
sudo apt-get update
sudo apt-get install -y python3 python3-pip mosquitto mosquitto-clients git

echo ""
echo -e "${BLUE}Prüfe ob Zigbee2MQTT bereits installiert ist...${NC}"
if ! command -v zigbee2mqtt &> /dev/null; then
    echo -e "${YELLOW}Zigbee2MQTT nicht gefunden. Möchtest du es installieren? (j/N):${NC}"
    read -p "> " install_z2m

    if [[ $install_z2m =~ ^[Jj]$ ]]; then
        echo -e "${GREEN}Installiere Zigbee2MQTT...${NC}"

        # Node.js installieren
        echo "Installiere Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs

        # Zigbee2MQTT installieren
        echo "Klone Zigbee2MQTT Repository..."
        sudo mkdir -p /opt/zigbee2mqtt
        sudo chown -R ${USER}: /opt/zigbee2mqtt
        git clone --depth 1 https://github.com/Koenkk/zigbee2mqtt.git /opt/zigbee2mqtt
        cd /opt/zigbee2mqtt
        npm ci

        echo ""
        echo -e "${YELLOW}USB Zigbee-Stick Pfad eingeben:${NC}"
        echo "Standard: /dev/ttyACM0 (oder /dev/ttyUSB0)"
        read -p "USB Port [/dev/ttyACM0]: " usb_port
        usb_port=${usb_port:-/dev/ttyACM0}

        # Konfiguration erstellen
        cat > /opt/zigbee2mqtt/data/configuration.yaml << EOF
homeassistant: false
permit_join: true
mqtt:
  base_topic: zigbee2mqtt
  server: mqtt://localhost:1883
serial:
  port: $usb_port
frontend:
  port: 8080
advanced:
  log_level: info
  network_key: GENERATE
EOF

        # Systemd Service erstellen
        sudo tee /etc/systemd/system/zigbee2mqtt.service > /dev/null << 'EOF'
[Unit]
Description=zigbee2mqtt
After=network.target mosquitto.service

[Service]
Type=simple
User=pi
WorkingDirectory=/opt/zigbee2mqtt
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

        sudo systemctl daemon-reload
        sudo systemctl enable zigbee2mqtt
        sudo systemctl start zigbee2mqtt

        echo -e "${GREEN}✓ Zigbee2MQTT installiert${NC}"
        echo -e "${YELLOW}Frontend verfügbar unter: http://$(hostname -I | cut -d' ' -f1):8080${NC}"
    fi
else
    echo -e "${GREEN}✓ Zigbee2MQTT bereits installiert${NC}"
fi

echo ""
echo -e "${GREEN}2. Monitor Installation...${NC}"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Dateien kopieren (in Produktion: git clone)
echo "Kopiere Dateien..."
# Hier würden die Dateien vom Repo geklont

echo ""
echo -e "${GREEN}3. Python Dependencies installieren...${NC}"
pip3 install -r requirements.txt

echo ""
echo -e "${BLUE}4. Konfiguration...${NC}"

read -p "API URL [https://temperature-api.dyntech.workers.dev/api/temperature]: " api_url
api_url=${api_url:-https://temperature-api.dyntech.workers.dev/api/temperature}

read -p "Standort-Name [strehlgasse]: " location
location=${location:-strehlgasse}

echo ""
echo -e "${YELLOW}Finde Zigbee-Sensor Device Name:${NC}"
echo "Öffne Zigbee2MQTT Frontend: http://$(hostname -I | cut -d' ' -f1):8080"
echo "Oder verwende: mosquitto_sub -t 'zigbee2mqtt/#' -v"
echo ""
read -p "Sensor Device Name: " sensor_name

# Konfiguration schreiben
cat > "$INSTALL_DIR/config.py" << EOF
API_URL = "$api_url"
LOCATION = "$location"
MQTT_BROKER = "localhost"
MQTT_PORT = 1883
MQTT_USER = None
MQTT_PASSWORD = None
SENSOR_DEVICE_NAME = "$sensor_name"
MIN_SEND_INTERVAL = 30
EOF

# Config in Python-Datei einbinden
sed -i 's/^API_URL = .*/from config import */' "$INSTALL_DIR/zigbee_temp_monitor.py" 2>/dev/null || true

echo ""
echo -e "${GREEN}5. Teste Monitor...${NC}"
echo "Starte Test (30 Sekunden)..."
timeout 30 python3 zigbee_temp_monitor.py || true

echo ""
read -p "Als Service einrichten? (j/N): " install_service

if [[ $install_service =~ ^[Jj]$ ]]; then
    echo -e "${GREEN}6. Service einrichten...${NC}"

    cat > /tmp/zigbee-temp-monitor.service << EOF
[Unit]
Description=Zigbee Temperature Monitor Service
After=network.target zigbee2mqtt.service mosquitto.service
Wants=zigbee2mqtt.service mosquitto.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/python3 $INSTALL_DIR/zigbee_temp_monitor.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    sudo mv /tmp/zigbee-temp-monitor.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable zigbee-temp-monitor.service
    sudo systemctl start zigbee-temp-monitor.service

    echo -e "${GREEN}✓ Service gestartet!${NC}"
fi

echo ""
echo -e "${GREEN}=============================================="
echo "Installation abgeschlossen!"
echo "==============================================${NC}"
echo ""
echo -e "${BLUE}Wichtige URLs:${NC}"
echo "  Dashboard:       https://strehlgasse-temp.pages.dev"
echo "  Zigbee2MQTT:     http://$(hostname -I | cut -d' ' -f1):8080"
echo ""
echo -e "${BLUE}Nützliche Befehle:${NC}"
echo "  Monitor Status:     sudo systemctl status zigbee-temp-monitor"
echo "  Monitor Logs:       sudo journalctl -u zigbee-temp-monitor -f"
echo "  Zigbee2MQTT Status: sudo systemctl status zigbee2mqtt"
echo "  Zigbee2MQTT Logs:   sudo journalctl -u zigbee2mqtt -f"
echo "  MQTT abonnieren:    mosquitto_sub -t 'zigbee2mqtt/#' -v"
echo "  Test:               python3 $INSTALL_DIR/zigbee_temp_monitor.py"
echo ""
echo -e "${YELLOW}Nächste Schritte:${NC}"
echo "1. Öffne Zigbee2MQTT Frontend und paare deinen Sensor"
echo "2. Notiere den Device-Namen und trage ihn in config.py ein"
echo "3. Starte den Service neu: sudo systemctl restart zigbee-temp-monitor"
echo "4. Überprüfe die Logs ob Daten gesendet werden"
