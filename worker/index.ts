interface Env {
  DB: D1Database;
}

interface TemperatureReading {
  temperature: number;
  humidity?: number;
  location?: string;
  timestamp?: number;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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
        const location = data.location || 'default';

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
        const location = url.searchParams.get('location') || 'default';
        const limit = parseInt(url.searchParams.get('limit') || '1000');

        const timeThreshold = Date.now() - (hours * 60 * 60 * 1000);

        const { results } = await env.DB.prepare(
          'SELECT * FROM temperature_readings WHERE location = ? AND timestamp >= ? ORDER BY timestamp DESC LIMIT ?'
        )
          .bind(location, timeThreshold, limit)
          .all();

        return new Response(JSON.stringify({ data: results }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // GET /api/temperature/latest - Get latest reading
      if (url.pathname === '/api/temperature/latest' && request.method === 'GET') {
        const location = url.searchParams.get('location') || 'default';

        const result = await env.DB.prepare(
          'SELECT * FROM temperature_readings WHERE location = ? ORDER BY timestamp DESC LIMIT 1'
        )
          .bind(location)
          .first();

        return new Response(JSON.stringify({ data: result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // GET /api/temperature/stats - Get statistics
      if (url.pathname === '/api/temperature/stats' && request.method === 'GET') {
        const hours = parseInt(url.searchParams.get('hours') || '24');
        const location = url.searchParams.get('location') || 'default';
        const timeThreshold = Date.now() - (hours * 60 * 60 * 1000);

        const result = await env.DB.prepare(
          `SELECT
            AVG(temperature) as avg_temp,
            MIN(temperature) as min_temp,
            MAX(temperature) as max_temp,
            AVG(humidity) as avg_humidity,
            COUNT(*) as count
          FROM temperature_readings
          WHERE location = ? AND timestamp >= ?`
        )
          .bind(location, timeThreshold)
          .first();

        return new Response(JSON.stringify({ data: result }), {
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
