# 🌡️ Temperature Dashboard

Eine moderne, grafisch ansprechende Web-Anwendung zur Visualisierung von Temperaturverläufen, deployed auf Cloudflare Pages und Workers.

## ✨ Features

- 📊 Interaktive Echtzeit-Graphen mit Chart.js
- 🎨 Modernes, responsives Design mit Farbverlauf-Hintergrund
- 📱 Mobile-optimiert
- ⚡ Cloudflare Workers API mit D1 Datenbank
- 🌐 Cloudflare Pages Hosting
- 📈 Statistiken: Durchschnitt, Min, Max
- 💧 Unterstützung für Luftfeuchtigkeit
- ⏱️ Verschiedene Zeitbereiche (1h, 6h, 24h, 1 Woche)
- 🔄 Auto-Refresh alle 30 Sekunden

## 🚀 Quick Start

### Voraussetzungen

- Node.js (v18+)
- npm oder yarn
- Cloudflare Account
- Wrangler CLI

### Installation

```bash
# Dependencies installieren
npm install

# Wrangler CLI installieren (falls noch nicht vorhanden)
npm install -g wrangler
```

### Lokale Entwicklung

1. **Worker lokal starten:**

```bash
npm run worker:dev
```

Der Worker läuft auf `http://localhost:8787`

2. **Frontend lokal starten:**

```bash
npm run dev
```

Das Frontend läuft auf `http://localhost:3000`

## 📦 Deployment auf Cloudflare

### 1. D1 Datenbank erstellen

```bash
# Datenbank erstellen
wrangler d1 create temperature-db

# Die Database ID wird angezeigt - kopiere sie!
# Füge sie in wrangler.toml ein
```

Bearbeite [wrangler.toml](wrangler.toml) und ersetze `your-database-id-here` mit deiner tatsächlichen Database ID.

### 2. Datenbank-Schema initialisieren

```bash
# Schema in die Datenbank laden
wrangler d1 execute temperature-db --file=worker/schema.sql

# Für Production
wrangler d1 execute temperature-db --env=production --file=worker/schema.sql
```

### 3. Worker deployen

```bash
npm run worker:deploy
```

Nach dem Deployment erhältst du eine URL wie: `https://temperature-api.your-subdomain.workers.dev`

### 4. Frontend für Cloudflare Pages vorbereiten

Bearbeite [.env.example](.env.example) und erstelle eine `.env` Datei:

```bash
# .env
VITE_API_URL=https://temperature-api.your-subdomain.workers.dev
```

Ersetze die URL mit deiner tatsächlichen Worker-URL.

### 5. Frontend bauen und deployen

```bash
# Build erstellen
npm run build

# Pages Projekt erstellen (nur beim ersten Mal)
wrangler pages project create temperature-dashboard

# Deployen
wrangler pages deploy dist --project-name=temperature-dashboard
```

### 6. Alternativ: GitHub Integration

1. Repository auf GitHub pushen
2. In Cloudflare Dashboard → Pages → "Create a project"
3. GitHub Repository verbinden
4. Build-Einstellungen:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Environment variables:** `VITE_API_URL=https://your-worker-url.workers.dev`

## 🔌 API Endpunkte

### POST /api/temperature

Neuen Temperaturwert hinzufügen:

```bash
curl -X POST https://your-worker.workers.dev/api/temperature \
  -H "Content-Type: application/json" \
  -d '{
    "temperature": 22.5,
    "humidity": 65,
    "location": "default"
  }'
```

### GET /api/temperature

Temperaturwerte abrufen:

```bash
# Letzte 24 Stunden
curl https://your-worker.workers.dev/api/temperature?hours=24

# Mit Location-Filter
curl https://your-worker.workers.dev/api/temperature?hours=24&location=office
```

### GET /api/temperature/latest

Aktuellsten Wert abrufen:

```bash
curl https://your-worker.workers.dev/api/temperature/latest
```

### GET /api/temperature/stats

Statistiken abrufen:

```bash
curl https://your-worker.workers.dev/api/temperature/stats?hours=24
```

## 🎨 Screenshots

Die Oberfläche bietet:
- Großes, farbiges Dashboard mit Verlaufshintergrund
- Karten mit aktuellen Werten, Durchschnitt, Min und Max
- Interaktiver Chart mit Zoom und Hover-Details
- Zeitbereich-Auswahl
- Formular zum Hinzufügen neuer Messwerte

## 🛠️ Technologie-Stack

**Frontend:**
- React 18
- TypeScript
- Vite
- Chart.js & react-chartjs-2
- date-fns

**Backend:**
- Cloudflare Workers
- Cloudflare D1 (SQLite)
- TypeScript

**Hosting:**
- Cloudflare Pages (Frontend)
- Cloudflare Workers (API)

## 📝 Daten hinzufügen

### Über die Web-Oberfläche

Nutze das Formular auf der Seite, um manuell Werte hinzuzufügen.

### Über die API

```javascript
// Mit fetch
fetch('https://your-worker.workers.dev/api/temperature', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    temperature: 23.5,
    humidity: 60
  })
})

// Mit curl
curl -X POST https://your-worker.workers.dev/api/temperature \
  -H "Content-Type: application/json" \
  -d '{"temperature": 23.5, "humidity": 60}'
```

### Integration mit IoT-Geräten

Du kannst jeden Temperatursensor (z.B. ESP32, Raspberry Pi, Arduino) integrieren:

```python
# Python Beispiel
import requests
import time

def send_temperature(temp, humidity=None):
    url = "https://your-worker.workers.dev/api/temperature"
    data = {"temperature": temp}
    if humidity:
        data["humidity"] = humidity

    response = requests.post(url, json=data)
    return response.json()

# Kontinuierlich senden
while True:
    temp = read_temperature_sensor()  # Deine Sensor-Funktion
    send_temperature(temp)
    time.sleep(60)  # Alle 60 Sekunden
```

## 🔧 Konfiguration

### Mehrere Standorte

Du kannst verschiedene Standorte tracken, indem du den `location` Parameter verwendest:

```javascript
// Büro
fetch('/api/temperature', {
  method: 'POST',
  body: JSON.stringify({
    temperature: 22,
    location: 'office'
  })
})

// Zuhause
fetch('/api/temperature', {
  method: 'POST',
  body: JSON.stringify({
    temperature: 24,
    location: 'home'
  })
})
```

## 🐛 Troubleshooting

### Worker-Fehler: "DB is not defined"

Stelle sicher, dass die D1-Datenbank in [wrangler.toml](wrangler.toml) korrekt konfiguriert ist.

### CORS-Fehler

Der Worker erlaubt alle Origins (`*`). Für Production solltest du dies einschränken.

### Build-Fehler

```bash
# Cache leeren und neu installieren
rm -rf node_modules package-lock.json
npm install
npm run build
```

## 📄 Lizenz

MIT

## 🤝 Beitragen

Pull Requests sind willkommen!

## 📞 Support

Bei Fragen oder Problemen öffne ein Issue im Repository.
