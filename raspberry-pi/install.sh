#!/bin/bash
###############################################################################
# Installation-Skript für Raspberry Pi Temperatur-Sensor
# Dieses Skript installiert und konfiguriert den Sensor-Service
###############################################################################

set -e

echo "======================================"
echo "Temperatur-Sensor Installation"
echo "======================================"
echo ""

# Farben für Ausgabe
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Prüfe ob als root ausgeführt
if [ "$EUID" -eq 0 ]; then
    echo -e "${RED}Bitte führe das Skript NICHT als root aus!${NC}"
    echo "Verwende: ./install.sh"
    exit 1
fi

# Installation Verzeichnis
INSTALL_DIR="$HOME/temperature-sensor"

echo -e "${GREEN}1. System-Pakete aktualisieren...${NC}"
sudo apt-get update
sudo apt-get install -y python3 python3-pip git

echo ""
echo -e "${GREEN}2. Installation Verzeichnis erstellen...${NC}"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

echo ""
echo -e "${GREEN}3. Dateien kopieren...${NC}"
# Hier würden normalerweise die Dateien von GitHub geklont werden
# Für jetzt kopieren wir sie
cp ../temp_sensor.py .
cp ../requirements.txt .
cp ../config.example.py config.py

echo ""
echo -e "${GREEN}4. Python Dependencies installieren...${NC}"
pip3 install -r requirements.txt

echo ""
echo -e "${YELLOW}Welchen Sensor verwendest du?${NC}"
echo "1) DHT22 (empfohlen)"
echo "2) DHT11"
echo "3) DS18B20"
read -p "Wähle (1-3): " sensor_choice

case $sensor_choice in
    1)
        SENSOR_TYPE="DHT22"
        ;;
    2)
        SENSOR_TYPE="DHT11"
        ;;
    3)
        SENSOR_TYPE="DS18B20"
        # DS18B20 benötigt 1-Wire Interface
        echo -e "${GREEN}Aktiviere 1-Wire Interface...${NC}"
        if ! grep -q "^dtoverlay=w1-gpio" /boot/config.txt; then
            echo "dtoverlay=w1-gpio" | sudo tee -a /boot/config.txt
            echo -e "${YELLOW}Neustart erforderlich für 1-Wire!${NC}"
        fi
        sudo modprobe w1-gpio
        sudo modprobe w1-therm
        ;;
    *)
        echo -e "${RED}Ungültige Auswahl${NC}"
        exit 1
        ;;
esac

echo ""
read -p "API URL [https://temperature-api.dyntech.workers.dev/api/temperature]: " api_url
api_url=${api_url:-https://temperature-api.dyntech.workers.dev/api/temperature}

echo ""
read -p "Standort-Name [strehlgasse]: " location
location=${location:-strehlgasse}

echo ""
read -p "Messintervall in Sekunden [60]: " interval
interval=${interval:-60}

echo ""
echo -e "${GREEN}5. Konfiguration schreiben...${NC}"
cat > config.py << EOF
# Automatisch generierte Konfiguration

API_URL = "$api_url"
SENSOR_TYPE = "$SENSOR_TYPE"
SENSOR_PIN = 4
INTERVAL = $interval
LOCATION = "$location"
EOF

echo ""
echo -e "${GREEN}6. Teste Sensor...${NC}"
echo "Führe einen Test-Lauf durch..."
timeout 10 python3 temp_sensor.py || true

echo ""
read -p "Möchtest du den Service als Systemd-Service einrichten? (j/N): " install_service

if [[ $install_service =~ ^[Jj]$ ]]; then
    echo -e "${GREEN}7. Systemd Service einrichten...${NC}"

    # Service-Datei erstellen
    cat > /tmp/temp-sensor.service << EOF
[Unit]
Description=Temperature Sensor Service
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/python3 $INSTALL_DIR/temp_sensor.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    sudo mv /tmp/temp-sensor.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable temp-sensor.service
    sudo systemctl start temp-sensor.service

    echo ""
    echo -e "${GREEN}Service erfolgreich gestartet!${NC}"
    echo "Status: sudo systemctl status temp-sensor"
    echo "Logs: sudo journalctl -u temp-sensor -f"
fi

echo ""
echo -e "${GREEN}======================================"
echo "Installation abgeschlossen!"
echo "======================================${NC}"
echo ""
echo "Nützliche Befehle:"
echo "  Service starten:   sudo systemctl start temp-sensor"
echo "  Service stoppen:   sudo systemctl stop temp-sensor"
echo "  Service Status:    sudo systemctl status temp-sensor"
echo "  Live Logs:         sudo journalctl -u temp-sensor -f"
echo "  Manueller Test:    python3 $INSTALL_DIR/temp_sensor.py"
echo ""
echo -e "${YELLOW}Tipp: Überprüfe die Logs, um sicherzustellen, dass Daten gesendet werden!${NC}"
