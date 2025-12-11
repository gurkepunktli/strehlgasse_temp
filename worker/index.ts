interface Env {
  DB: D1Database;
}

interface TemperatureReading {
  temperature: number;
  humidity?: number;
  location?: string;
  timestamp?: number;
}

interface MetarReading {
  station: string;
  raw_text: string;
  temperature: number | null;
  dewpoint: number | null;
  qnh_hpa: number | null;
  wind_dir: number | null;
  wind_speed_kt: number | null;
  timestamp: number;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const toNumberOrNull = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const fetchMetarData = async (station: string, hours: number): Promise<MetarReading[]> => {
  const limitedHours = Math.min(Math.max(hours, 1), 168); // cap to 7 days
  const url = `https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(station)}&format=json&taf=false&hours=${limitedHours}`;

  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    cf: { cacheEverything: true, cacheTtl: 300 }
  });

  if (!response.ok) {
    throw new Error(`METAR upstream error: ${response.status}`);
  }

  const metars = await response.json();

  if (!Array.isArray(metars)) {
    return [];
  }

  return metars
    .map((entry: any) => {
      const timestamp = entry?.reportTime ? Date.parse(entry.reportTime) : null;

      if (!timestamp || Number.isNaN(timestamp)) {
        return null;
      }

      return {
        station: entry.icaoId || station,
        raw_text: entry.rawOb || '',
        temperature: toNumberOrNull(entry.temp),
        dewpoint: toNumberOrNull(entry.dewp),
        qnh_hpa: toNumberOrNull(entry.altim),
        wind_dir: entry.wdir === 'VRB' ? null : toNumberOrNull(entry.wdir),
        wind_speed_kt: toNumberOrNull(entry.wspd),
        timestamp,
      } as MetarReading;
    })
    .filter((entry: MetarReading | null): entry is MetarReading => Boolean(entry))
    .sort((a: MetarReading, b: MetarReading) => a.timestamp - b.timestamp);
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // POST /api/temperature - Add new temperature reading
      if (url.pathname === '/api/temperature' && request.method === 'POST') {
        const data: TemperatureReading = await request.json();

        if (typeof data.temperature !== 'number') {
          return new Response(JSON.stringify({ error: 'Temperature is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const timestamp = data.timestamp || Date.now();
        // Default to primary location if none provided to keep dashboard in sync
        const location = data.location || 'strehlgasse';

        await env.DB.prepare(
          'INSERT INTO temperature_readings (temperature, humidity, location, timestamp) VALUES (?, ?, ?, ?)'
        )
          .bind(data.temperature, data.humidity || null, location, timestamp)
          .run();

        return new Response(JSON.stringify({ success: true, timestamp }), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // GET /api/temperature - Get temperature readings
      if (url.pathname === '/api/temperature' && request.method === 'GET') {
        const hours = parseInt(url.searchParams.get('hours') || '24');
        const location = url.searchParams.get('location');
        const limit = parseInt(url.searchParams.get('limit') || '1000');

        const timeThreshold = Date.now() - (hours * 60 * 60 * 1000);

        let readingsQuery;
        if (location) {
          readingsQuery = env.DB.prepare(
            'SELECT * FROM temperature_readings WHERE location = ? AND timestamp >= ? ORDER BY timestamp DESC LIMIT ?'
          ).bind(location, timeThreshold, limit);
        } else {
          readingsQuery = env.DB.prepare(
            'SELECT * FROM temperature_readings WHERE timestamp >= ? ORDER BY timestamp DESC LIMIT ?'
          ).bind(timeThreshold, limit);
        }

        const { results } = await readingsQuery.all();

        return new Response(JSON.stringify({ data: results }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // GET /api/temperature/latest - Get latest reading
      if (url.pathname === '/api/temperature/latest' && request.method === 'GET') {
        const location = url.searchParams.get('location');

        const latestQuery = location
          ? env.DB.prepare(
            'SELECT * FROM temperature_readings WHERE location = ? ORDER BY timestamp DESC LIMIT 1'
          ).bind(location)
          : env.DB.prepare(
            'SELECT * FROM temperature_readings ORDER BY timestamp DESC LIMIT 1'
          );

        const result = await latestQuery.first();

        return new Response(JSON.stringify({ data: result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // GET /api/temperature/stats - Get statistics
      if (url.pathname === '/api/temperature/stats' && request.method === 'GET') {
        const hours = parseInt(url.searchParams.get('hours') || '24');
        const location = url.searchParams.get('location');
        const timeThreshold = Date.now() - (hours * 60 * 60 * 1000);

        const statsQuery = location
          ? env.DB.prepare(
            `SELECT
              AVG(temperature) as avg_temp,
              MIN(temperature) as min_temp,
              MAX(temperature) as max_temp,
              AVG(humidity) as avg_humidity,
              COUNT(*) as count
            FROM temperature_readings
            WHERE location = ? AND timestamp >= ?`
          ).bind(location, timeThreshold)
          : env.DB.prepare(
            `SELECT
              AVG(temperature) as avg_temp,
              MIN(temperature) as min_temp,
              MAX(temperature) as max_temp,
              AVG(humidity) as avg_humidity,
              COUNT(*) as count
            FROM temperature_readings
            WHERE timestamp >= ?`
          ).bind(timeThreshold);

        const result = await statsQuery.first();

        return new Response(JSON.stringify({ data: result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // GET /api/metar - Fetch METAR data (default: LSZH)
      if (url.pathname === '/api/metar' && request.method === 'GET') {
        const station = (url.searchParams.get('station') || 'LSZH').toUpperCase();
        const hours = parseInt(url.searchParams.get('hours') || '24');
        const metarData = await fetchMetarData(station, hours || 24);

        return new Response(JSON.stringify({ data: metarData }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
