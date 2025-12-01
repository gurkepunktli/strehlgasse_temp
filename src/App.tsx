import { useState, useEffect } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { format } from 'date-fns'
import './App.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787'

interface TemperatureReading {
  id: number
  temperature: number
  humidity: number | null
  location: string
  timestamp: number
  created_at: string
}

interface Stats {
  avg_temp: number
  min_temp: number
  max_temp: number
  avg_humidity: number | null
  count: number
}

function App() {
  const [readings, setReadings] = useState<TemperatureReading[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState(24)
  const [newTemp, setNewTemp] = useState('')
  const [newHumidity, setNewHumidity] = useState('')

  const fetchData = async () => {
    try {
      const [readingsRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/temperature?hours=${timeRange}&limit=500`),
        fetch(`${API_URL}/api/temperature/stats?hours=${timeRange}`)
      ])

      const readingsData = await readingsRes.json()
      const statsData = await statsRes.json()

      setReadings(readingsData.data.reverse())
      setStats(statsData.data)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [timeRange])

  const handleAddReading = async (e: React.FormEvent) => {
    e.preventDefault()

    const temperature = parseFloat(newTemp)
    const humidity = newHumidity ? parseFloat(newHumidity) : undefined

    if (isNaN(temperature)) return

    try {
      const response = await fetch(`${API_URL}/api/temperature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temperature, humidity }),
      })

      if (response.ok) {
        setNewTemp('')
        setNewHumidity('')
        fetchData()
      }
    } catch (error) {
      console.error('Error adding reading:', error)
    }
  }

  const chartData = {
    labels: readings.map(r => format(new Date(r.timestamp), 'HH:mm')),
    datasets: [
      {
        label: 'Temperatur (°C)',
        data: readings.map(r => r.temperature),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        fill: true,
        tension: 0.4,
        yAxisID: 'y',
      },
      ...(readings.some(r => r.humidity !== null) ? [{
        label: 'Luftfeuchtigkeit (%)',
        data: readings.map(r => r.humidity),
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.1)',
        fill: true,
        tension: 0.4,
        yAxisID: 'y1',
      }] : [])
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#fff',
          font: { size: 14 }
        }
      },
      title: {
        display: true,
        text: 'Temperaturverlauf',
        color: '#fff',
        font: { size: 20 }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
      }
    },
    scales: {
      x: {
        ticks: { color: '#fff' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        ticks: { color: '#fff' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        title: {
          display: true,
          text: 'Temperatur (°C)',
          color: '#fff'
        }
      },
      ...(readings.some(r => r.humidity !== null) ? {
        y1: {
          type: 'linear' as const,
          display: true,
          position: 'right' as const,
          ticks: { color: '#fff' },
          grid: { drawOnChartArea: false },
          title: {
            display: true,
            text: 'Luftfeuchtigkeit (%)',
            color: '#fff'
          }
        }
      } : {})
    },
  }

  if (loading) {
    return (
      <div className="app">
        <div className="loading">Lade Daten...</div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🌡️ Temperature Dashboard</h1>
        <p>Echtzeit-Temperaturüberwachung</p>
      </header>

      <div className="stats-grid">
        {stats && (
          <>
            <div className="stat-card">
              <div className="stat-label">Aktuell</div>
              <div className="stat-value">
                {readings[readings.length - 1]?.temperature.toFixed(1) || '--'}°C
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Durchschnitt</div>
              <div className="stat-value">{stats.avg_temp ? stats.avg_temp.toFixed(1) : '--'}°C</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Minimum</div>
              <div className="stat-value blue">{stats.min_temp ? stats.min_temp.toFixed(1) : '--'}°C</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Maximum</div>
              <div className="stat-value red">{stats.max_temp ? stats.max_temp.toFixed(1) : '--'}°C</div>
            </div>
            {stats.avg_humidity !== null && (
              <div className="stat-card">
                <div className="stat-label">Ø Luftfeuchtigkeit</div>
                <div className="stat-value">{stats.avg_humidity.toFixed(1)}%</div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="controls">
        <div className="time-range">
          <label>Zeitraum:</label>
          <select value={timeRange} onChange={(e) => setTimeRange(Number(e.target.value))}>
            <option value={1}>Letzte Stunde</option>
            <option value={6}>Letzte 6 Stunden</option>
            <option value={24}>Letzte 24 Stunden</option>
            <option value={168}>Letzte Woche</option>
          </select>
        </div>

        <form onSubmit={handleAddReading} className="add-reading">
          <input
            type="number"
            step="0.1"
            placeholder="Temperatur (°C)"
            value={newTemp}
            onChange={(e) => setNewTemp(e.target.value)}
            required
          />
          <input
            type="number"
            step="0.1"
            placeholder="Luftfeuchtigkeit (%)"
            value={newHumidity}
            onChange={(e) => setNewHumidity(e.target.value)}
          />
          <button type="submit">Hinzufügen</button>
        </form>
      </div>

      <div className="chart-container">
        <Line data={chartData} options={chartOptions} />
      </div>

      <footer className="footer">
        <p>Messwerte: {stats?.count || 0} | Aktualisiert alle 30 Sekunden</p>
      </footer>
    </div>
  )
}

export default App
