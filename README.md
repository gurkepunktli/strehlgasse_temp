# 🌡️ Strehlgasse Temperature Dashboard

Live-Temperaturüberwachung mit **Sonoff SNZB-02P** Zigbee-Sensor, Raspberry Pi und Cloudflare.

**🔗 Live Dashboard:** https://strehlgasse-temp.pages.dev

## 📋 Übersicht

Dieses Projekt besteht aus drei Komponenten:

1. **Raspberry Pi Service** - Empfängt Daten vom Zigbee-Sensor über Zigbee2MQTT
2. **Cloudflare Workers API** - Speichert Daten in D1 Datenbank
3. **React Dashboard** - Visualisiert Daten mit interaktiven Charts

```
┌─────────────────────┐
│  Sonoff SNZB-02P    │
│  Zigbee Sensor      │
└──────────┬──────────┘
           │ Zigbee
           ▼
┌─────────────────────┐     HTTPS      ┌─────────────────────┐
│  Raspberry Pi       │ ─────────────► │  Cloudflare Workers │
│  + Zigbee USB-Stick │                │  + D1 Database      │
│  + Zigbee2MQTT      │                └──────────┬──────────┘
└─────────────────────┘                           │
                                                  ▼
                                       ┌─────────────────────┐
                                       │  Cloudflare Pages   │
                                       │  React Dashboard    │
                                       └─────────────────────┘
```

## ✨ Features

### Dashboard
- 📊 Interaktive Echtzeit-Graphen mit Chart.js
- 🎨 Modernes, responsives Design mit Glasmorphismus-Effekten
- 📱 Mobile-optimiert
- 🔴 Live-Status-Indikator mit Pulsanimation
- 📈 Statistik-Karten (Aktuell, Durchschnitt, Min, Max)
- 💧 Luftfeuchtigkeit-Anzeige
- ⏱️ Flexible Zeitbereiche (1h, 6h, 24h, 7 Tage)
- 🔄 Auto-Refresh alle 30 Sekunden
- 📉 Trend-Anzeige (steigend/fallend)

### Backend
- ⚡ Cloudflare Workers (Edge Computing)
- 🗄️ D1 SQLite-Datenbank
- 🌍 CORS-ready API
- 📍 Multi-Location Support

### Raspberry Pi
- 🔌 Zigbee2MQTT Integration
- 📡 MQTT-basierte Kommunikation
- 🛡️ Intelligentes Filtering (vermeidet redundante Requests)
- 🔄 Automatische Wiederverbindung
- 📝 Umfangreiches Logging
- ⚙️ Systemd Service für Auto-Start

## 🚀 Quick Start

### 1. Cloudflare Deployment

#### Worker & Datenbank deployen

```bash
# Repository klonen
git clone https://github.com/gurkepunktli/strehlgasse_temp.git
cd strehlgasse_temp

# Dependencies installieren
npm install

# Wrangler Login
npx wrangler login

# D1 Datenbank erstellen
npx wrangler d1 create temperature-db

# Database ID in wrangler.toml eintragen
# Öffne wrangler.toml und ersetze "your-database-id-here"

# Schema laden
npx wrangler d1 execute temperature-db --remote --file=worker/schema.sql

# Worker deployen
npx wrangler deploy
```

Notiere die Worker URL: `https://temperature-api.your-subdomain.workers.dev`

#### Frontend deployen

Option A: **GitHub Integration** (empfohlen)

1. Pushe Repository auf GitHub (bereits erledigt ✅)
2. Gehe zu Cloudflare Dashboard → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
3. Wähle Repository `strehlgasse_temp`
4. Build Settings:
   - Framework: **Vite**
   - Build command: `npm run build`
   - Build output directory: `dist`
5. Environment Variable:
   - Name: `VITE_API_URL`
   - Value: `https://temperature-api.your-subdomain.workers.dev`
6. **Save and Deploy**

Option B: **Direktes Deployment**

```bash
# Build erstellen
npm run build

# Deployen
npx wrangler pages deploy dist --project-name=strehlgasse-temp
```

### 2. Raspberry Pi Setup

Siehe [raspberry-pi/README.md](raspberry-pi/README.md) für detaillierte Anleitung.

**Kurzversion:**

```bash
# SSH zum Raspberry Pi
ssh pi@raspberrypi.local

# Repository klonen
git clone https://github.com/gurkepunktli/strehlgasse_temp.git
cd strehlgasse_temp/raspberry-pi

# Installation starten
chmod +x install_zigbee.sh
./install_zigbee.sh
```

Das Skript installiert:
- Zigbee2MQTT (falls noch nicht vorhanden)
- Python Dependencies
- Temperatur-Monitor Service

**Sensor pairen:**

1. Öffne Zigbee2MQTT: `http://<raspberry-pi-ip>:8080`
2. Klicke "Permit join"
3. Drücke Pairing-Taste am SNZB-02P (5 Sekunden)
4. Benenne Sensor (z.B. "strehlgasse_temp")
5. Trage Namen in `config.py` ein
6. Starte Service: `sudo systemctl restart zigbee-temp-monitor`

## 🛠️ Technologie-Stack

### Frontend
- **React 18** - UI Framework
- **TypeScript** - Type Safety
- **Vite** - Build Tool
- **Chart.js** - Datenvisualisierung
- **date-fns** - Datums-Formatierung

### Backend
- **Cloudflare Workers** - Serverless Edge Computing
- **Cloudflare D1** - SQLite-Datenbank
- **TypeScript** - Type Safety

### Raspberry Pi
- **Python 3** - Service Language
- **Zigbee2MQTT** - Zigbee Gateway
- **Mosquitto** - MQTT Broker
- **paho-mqtt** - MQTT Client Library

### Hardware
- **Raspberry Pi 3/4/5** - Server
- **Sonoff SNZB-02P** - Temperatursensor
- **Zigbee USB-Stick** - Sonoff Zigbee 3.0 Dongle Plus (oder kompatibel)

## 📡 API Endpunkte

### POST /api/temperature
Neuen Messwert hinzufügen (vom Raspberry Pi):

```bash
curl -X POST https://your-worker.workers.dev/api/temperature \
  -H "Content-Type: application/json" \
  -d '{
    "temperature": 22.5,
    "humidity": 65,
    "location": "strehlgasse"
  }'
```

### GET /api/temperature
Messwerte abrufen:

```bash
# Letzte 24 Stunden
curl https://your-worker.workers.dev/api/temperature?hours=24

# Mit Location-Filter
curl https://your-worker.workers.dev/api/temperature?hours=24&location=strehlgasse
```

### GET /api/temperature/latest
Aktuellsten Wert:

```bash
curl https://your-worker.workers.dev/api/temperature/latest
```

### GET /api/temperature/stats
Statistiken:

```bash
curl https://your-worker.workers.dev/api/temperature/stats?hours=24
```

## 📁 Projektstruktur

```
strehlgasse_temp/
├── src/                      # React Frontend
│   ├── App.tsx              # Haupt-Komponente
│   ├── App.css              # Styling
│   └── main.tsx             # Entry Point
├── worker/                   # Cloudflare Workers
│   ├── index.ts             # API Handler
│   └── schema.sql           # D1 Schema
├── raspberry-pi/            # Raspberry Pi Service
│   ├── zigbee_temp_monitor.py    # Monitor Service
│   ├── install_zigbee.sh         # Installations-Skript
│   ├── requirements.txt          # Python Deps
│   └── README.md                 # Pi Dokumentation
├── package.json             # Node Dependencies
├── wrangler.toml           # Cloudflare Config
├── vite.config.ts          # Vite Config
└── README.md               # Diese Datei
```

## 🔧 Lokale Entwicklung

### Frontend + Worker lokal

```bash
# Terminal 1: Worker
npm run worker:dev

# Terminal 2: Frontend
npm run dev
```

Frontend: http://localhost:3000
Worker API: http://localhost:8787

### Raspberry Pi Service testen

```bash
# Auf dem Pi:
cd ~/temperature-sensor
python3 zigbee_temp_monitor.py

# Logs live ansehen
sudo journalctl -u zigbee-temp-monitor -f
```

## 📊 Sonoff SNZB-02P Details

- **Modell:** SNZB-02P
- **Temperaturbereich:** -10°C bis +60°C
- **Luftfeuchtigkeit:** 0-95% RH
- **Genauigkeit:** ±0.2°C / ±2% RH
- **Batterie:** CR2450 (ca. 1 Jahr)
- **Update-Intervall:** ~5 Minuten
- **Protokoll:** Zigbee 3.0
- **Preis:** ~10-15 EUR

## 🐛 Troubleshooting

### Dashboard zeigt keine Daten

1. **Prüfe API:** `curl https://your-worker.workers.dev/api/temperature/latest`
2. **Prüfe Browser Console:** F12 → Console
3. **Environment Variable korrekt?** In Cloudflare Pages Settings

### Raspberry Pi sendet nicht

```bash
# Service Status
sudo systemctl status zigbee-temp-monitor

# Logs prüfen
sudo journalctl -u zigbee-temp-monitor -n 50

# MQTT Topics ansehen
mosquitto_sub -t 'zigbee2mqtt/#' -v

# Zigbee2MQTT Frontend
http://<pi-ip>:8080
```

### Sensor zeigt falsche Werte

- SNZB-02P braucht ca. 10-15 Minuten zum Kalibrieren nach Batteriewechsel
- Bei direkter Sonneneinstrahlung können Werte verfälscht sein

## 🔐 Sicherheit

- ✅ HTTPS/TLS 1.3 für alle API-Calls
- ✅ CORS Headers konfiguriert
- ✅ Keine Secrets im Code
- ✅ MQTT läuft nur lokal (nicht exponiert)
- ✅ Cloudflare DDoS-Schutz

**Produktions-Empfehlung:**
- API-Key Authentication hinzufügen
- Rate Limiting aktivieren
- MQTT mit TLS/Auth absichern

## 📈 Performance

- **Frontend:** < 500 KB (gzipped)
- **API Response:** < 50 ms (Edge)
- **Pi CPU:** < 1%
- **Pi RAM:** ~30-50 MB
- **Kosten:** Kostenlos (Cloudflare Free Tier)

## 🔄 Updates

```bash
# Dashboard Update (automatisch via GitHub)
git push

# Pi Service Update
ssh pi@raspberrypi.local
cd ~/strehlgasse_temp
git pull
sudo systemctl restart zigbee-temp-monitor
```

## 📝 Lizenz

MIT License - siehe [LICENSE](LICENSE)

## 🤝 Contributing

Pull Requests sind willkommen!

1. Fork das Projekt
2. Feature Branch erstellen
3. Committe Änderungen
4. Push zum Branch
5. Pull Request öffnen

## 📞 Support

- **Issues:** https://github.com/gurkepunktli/strehlgasse_temp/issues
- **Dashboard:** https://strehlgasse-temp.pages.dev
- **Zigbee2MQTT Docs:** https://www.zigbee2mqtt.io/

## 🌟 Credits

- **Sonoff** - SNZB-02P Sensor
- **Zigbee2MQTT** - Zigbee Gateway Software
- **Cloudflare** - Hosting & Edge Computing
- **Chart.js** - Datenvisualisierung
