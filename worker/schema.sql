-- Temperature readings table
CREATE TABLE IF NOT EXISTS temperature_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  temperature REAL NOT NULL,
  humidity REAL,
  location TEXT DEFAULT 'default',
  timestamp INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_timestamp ON temperature_readings(timestamp);
CREATE INDEX IF NOT EXISTS idx_location ON temperature_readings(location);
