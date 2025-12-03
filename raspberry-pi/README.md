# Raspberry Pi Zigbee Temperatur-Monitor

Dieser Service empfängt Temperaturdaten vom **Sonoff SNZB-02P** Zigbee-Sensor und sendet sie an die Cloudflare Workers API.

## Hardware-Anforderungen

- Raspberry Pi (getestet mit Pi 3/4/5)
- Zigbee USB-Stick (z.B. Sonoff Zigbee 3.0 USB Dongle Plus, ConBee II, oder CC2531)
- **Sonoff SNZB-02P** Temperatursensor

## Funktionen

- ✅ Automatische Erkennung von SNZB-02P Sensoren über Zigbee2MQTT
- ✅ MQTT-basierte Kommunikation (lokal, kein Cloud-Dienst)
- ✅ Sendet Temperatur und Luftfeuchtigkeit an Cloudflare API
- ✅ Intelligentes Filtering (nur bei signifikanten Änderungen)
- ✅ Systemd Service für automatischen Start
- ✅ Umfangreiches Logging
- ✅ Automatische Wiederverbindung bei Netzwerkproblemen

## Schnellstart

### 1. Repository klonen

```bash
cd ~
git clone https://github.com/gurkepunktli/strehlgasse_temp.git
cd strehlgasse_temp/raspberry-pi
```

### 2. Installation ausführen

```bash
chmod +x install_zigbee.sh
./install_zigbee.sh
```

Das Installationsskript:
- Installiert alle benötigten Pakete
- Richtet Zigbee2MQTT ein (falls noch nicht vorhanden)
- Installiert den Temperatur-Monitor
- Konfiguriert den Systemd Service

### 3. Sensor pairen

1. Öffne Zigbee2MQTT Frontend: `http://<raspberry-pi-ip>:8080`
2. Klicke auf "Permit join" (oben rechts)
3. Drücke die Pairing-Taste am SNZB-02P für 5 Sekunden
4. Warte bis der Sensor in Zigbee2MQTT erscheint
5. Benenne den Sensor (z.B. "strehlgasse_temp")

### 4. Konfiguration anpassen

Bearbeite `/home/pi/temperature-sensor/config.py`:

```python
API_URL = "https://temperature-api.dyntech.workers.dev/api/temperature"
LOCATION = "strehlgasse"
SENSOR_DEVICE_NAME = "strehlgasse_temp"  # Name aus Zigbee2MQTT
```

### 5. Service starten

```bash
sudo systemctl restart zigbee-temp-monitor
sudo systemctl status zigbee-temp-monitor
```

## SNZB-02P Spezifikationen

- **Temperaturbereich:** -10°C bis +60°C
- **Luftfeuchtigkeit:** 0-95% RH
- **Genauigkeit:** ±0.2°C / ±2% RH
- **Batterie:** CR2450 (ca. 1 Jahr Laufzeit)
- **Aktualisierungsrate:** ca. alle 5 Minuten
- **Zigbee:** 3.0 kompatibel

## Verzeichnisstruktur

```
/home/pi/temperature-sensor/
├── zigbee_temp_monitor.py   # Haupt-Service
├── config.py                 # Konfiguration
├── requirements.txt          # Python Dependencies
└── install_zigbee.sh        # Installations-Skript
```

## Service-Befehle

```bash
# Status prüfen
sudo systemctl status zigbee-temp-monitor

# Service starten/stoppen
sudo systemctl start zigbee-temp-monitor
sudo systemctl stop zigbee-temp-monitor

# Service neustarten
sudo systemctl restart zigbee-temp-monitor

# Live-Logs anzeigen
sudo journalctl -u zigbee-temp-monitor -f

# Logs der letzten Stunde
sudo journalctl -u zigbee-temp-monitor --since "1 hour ago"
```

## Zigbee2MQTT Befehle

```bash
# Zigbee2MQTT Status
sudo systemctl status zigbee2mqtt

# Zigbee2MQTT Logs
sudo journalctl -u zigbee2mqtt -f

# Alle MQTT Topics anzeigen
mosquitto_sub -t 'zigbee2mqtt/#' -v
```

## Troubleshooting

### Sensor sendet keine Daten

1. **Prüfe ob Sensor in Zigbee2MQTT sichtbar ist:**
   - Öffne Frontend: `http://<pi-ip>:8080`
   - Sensor sollte in der Geräteliste sein

2. **Prüfe MQTT Messages:**
   ```bash
   mosquitto_sub -t 'zigbee2mqtt/strehlgasse_temp' -v
   ```

3. **Prüfe Monitor Logs:**
   ```bash
   sudo journalctl -u zigbee-temp-monitor -f
   ```

### USB-Stick wird nicht erkannt

```bash
# Liste USB-Geräte
lsusb

# Liste Serial Ports
ls -l /dev/tty*

# Meist:
# /dev/ttyACM0 - Sonoff Zigbee Stick
# /dev/ttyUSB0 - ConBee II
```

### Zigbee2MQTT startet nicht

```bash
# Logs prüfen
sudo journalctl -u zigbee2mqtt -n 50

# Konfiguration prüfen
cat /opt/zigbee2mqtt/data/configuration.yaml

# Manuell starten zum Debuggen
cd /opt/zigbee2mqtt
npm start
```

### "Permission denied" auf USB Port

```bash
# User zur dialout Gruppe hinzufügen
sudo usermod -a -G dialout $USER

# Neustart erforderlich
sudo reboot
```

## Konfigurationsoptionen

In `config.py`:

```python
# API Endpunkt
API_URL = "https://your-worker.workers.dev/api/temperature"

# Standort-Identifikation
LOCATION = "strehlgasse"

# MQTT Broker (normalerweise localhost)
MQTT_BROKER = "localhost"
MQTT_PORT = 1883

# Optional: MQTT Authentifizierung
MQTT_USER = None
MQTT_PASSWORD = None

# Device Name aus Zigbee2MQTT
SENSOR_DEVICE_NAME = "strehlgasse_temp"

# Minimum Sekunden zwischen API Calls
# Verhindert zu viele Requests bei kleinen Schwankungen
MIN_SEND_INTERVAL = 30
```

## Mehrere Sensoren

Du kannst mehrere SNZB-02P Sensoren überwachen:

1. **Option A: Ein Service pro Sensor**
   ```bash
   # Kopiere den Service
   sudo cp /etc/systemd/system/zigbee-temp-monitor.service \
           /etc/systemd/system/zigbee-temp-monitor-wohnzimmer.service

   # Passe WorkingDirectory und Sensor-Name an
   # Starte beide Services
   ```

2. **Option B: Modifiziere das Skript**
   - Ändere `SENSOR_DEVICE_NAME` zu einer Liste
   - Abonniere mehrere Topics

## Performance

- **CPU-Last:** < 1% (idle)
- **RAM:** ~30-50 MB
- **Netzwerk:** ~1 KB pro Messung
- **API Calls:** ~1-2 pro Minute (je nach Sensor-Updates)

## Sicherheit

- Alle Daten laufen über HTTPS (TLS 1.3)
- MQTT läuft lokal (nicht exponiert)
- Keine Cloud-Abhängigkeiten außer Cloudflare API
- API-Key optional über Environment Variables

## Updates

```bash
cd ~/strehlgasse_temp
git pull
sudo systemctl restart zigbee-temp-monitor
```

## Deinstallation

```bash
# Service stoppen und deaktivieren
sudo systemctl stop zigbee-temp-monitor
sudo systemctl disable zigbee-temp-monitor
sudo rm /etc/systemd/system/zigbee-temp-monitor.service

# Optional: Zigbee2MQTT entfernen
sudo systemctl stop zigbee2mqtt
sudo systemctl disable zigbee2mqtt
sudo rm -rf /opt/zigbee2mqtt
sudo rm /etc/systemd/system/zigbee2mqtt.service

# Dateien löschen
rm -rf ~/temperature-sensor
```

## Support

- **Issues:** https://github.com/gurkepunktli/strehlgasse_temp/issues
- **Dashboard:** https://strehlgasse-temp.pages.dev

## Lizenz

MIT
