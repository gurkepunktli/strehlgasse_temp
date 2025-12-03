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
  const [progress, setProgress] = useState(0)
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode')
    return saved ? JSON.parse(saved) : true
  })

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode))
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  const fetchData = async () => {
    try {
      const [readingsRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/temperature?hours=${timeRange}&limit=500`),
        fetch(`${API_URL}/api/temperature/stats?hours=${timeRange}`)
      ])

      const readingsData: any = await readingsRes.json()
      const statsData: any = await statsRes.json()

      setReadings(readingsData.data.reverse())
      setStats(statsData.data)
      setProgress(0)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [timeRange])

  // Progress animation (30 seconds)
  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        const next = prev + (100 / 30)
        return next >= 100 ? 0 : next
      })
    }, 1000)
    return () => clearInterval(progressInterval)
  }, [])

  const chartData = {
    labels: readings.map(r => {
      const date = new Date(r.timestamp)
      return timeRange > 24
        ? format(date, 'dd.MM HH:mm')
        : format(date, 'HH:mm')
    }),
    datasets: [
      {
        label: 'Temperatur (°C)',
        data: readings.map(r => r.temperature),
        borderColor: darkMode ? 'rgb(244, 114, 182)' : 'rgb(239, 68, 68)',
        backgroundColor: darkMode ? 'rgba(244, 114, 182, 0.1)' : 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: 0.4,
        yAxisID: 'y',
      },
      ...(readings.some(r => r.humidity !== null) ? [{
        label: 'Luftfeuchtigkeit (%)',
        data: readings.map(r => r.humidity),
        borderColor: darkMode ? 'rgb(96, 165, 250)' : 'rgb(59, 130, 246)',
        backgroundColor: darkMode ? 'rgba(96, 165, 250, 0.1)' : 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        yAxisID: 'y1',
      }] : [])
    ],
  }

  const textColor = darkMode ? '#e5e7eb' : '#ffffff'
  const gridColor = darkMode ? 'rgba(75, 85, 99, 0.3)' : 'rgba(255, 255, 255, 0.2)'

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
          color: textColor,
          font: { size: 14 },
          padding: 15
        }
      },
      title: {
        display: true,
        text: 'Temperaturverlauf',
        color: textColor,
        font: { size: 20, weight: 'bold' as const }
      },
      tooltip: {
        backgroundColor: darkMode ? 'rgba(17, 24, 39, 0.95)' : 'rgba(0, 0, 0, 0.85)',
        titleColor: textColor,
        bodyColor: textColor,
        borderColor: darkMode ? 'rgb(75, 85, 99)' : 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
        padding: 12,
        displayColors: true
      }
    },
    scales: {
      x: {
        ticks: { color: textColor },
        grid: { color: gridColor }
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        ticks: { color: textColor },
        grid: { color: gridColor },
        title: {
          display: true,
          text: 'Temperatur (°C)',
          color: textColor
        }
      },
      ...(readings.some(r => r.humidity !== null) ? {
        y1: {
          type: 'linear' as const,
          display: true,
          position: 'right' as const,
          ticks: { color: textColor },
          grid: { drawOnChartArea: false },
          title: {
            display: true,
            text: 'Luftfeuchtigkeit (%)',
            color: textColor
          }
        }
      } : {})
    },
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-white dark:text-gray-200 text-2xl animate-pulse">Lade Daten...</div>
      </div>
    )
  }

  // Check if last reading is within 10 minutes
  const isOnline = readings.length > 0 &&
    (Date.now() - readings[readings.length - 1].timestamp) < 10 * 60 * 1000

  // Find min/max with timestamps
  const minReading = readings.reduce((min, r) =>
    r.temperature < min.temperature ? r : min,
    readings[0] || { temperature: Infinity, timestamp: 0 }
  )
  const maxReading = readings.reduce((max, r) =>
    r.temperature > max.temperature ? r : max,
    readings[0] || { temperature: -Infinity, timestamp: 0 }
  )

  // Helper classes for light/dark mode
  const cardBg = darkMode ? 'bg-gray-800/30 border-gray-700/50' : 'bg-gray-50 border-gray-200'
  const textPrimary = darkMode ? 'text-gray-100' : 'text-gray-900'
  const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600'
  const buttonBg = darkMode ? 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900'
        : 'bg-white'
    }`}>
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className={`backdrop-blur-lg rounded-3xl p-6 mb-8 shadow-2xl border ${
          darkMode
            ? 'bg-gray-800/30 border-gray-700/50'
            : 'bg-gray-50/80 border-gray-200'
        }`}>
          <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
            <div className="text-center lg:text-left">
              <h1 className={`text-4xl font-bold mb-2 flex items-center justify-center lg:justify-start gap-3 ${
                darkMode ? 'text-gray-100' : 'text-gray-900'
              }`}>
                🌡️ Temperatur Aussenzelt
              </h1>
              <p className={`text-lg ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Raspberry Pi Sensor • Live Monitoring
              </p>
            </div>

            <div className="flex items-center gap-4">
              {/* Last Update */}
              <div className="flex flex-col items-end">
                <div className={`text-xs uppercase tracking-wide ${textSecondary}`}>
                  Letztes Update
                </div>
                <div className={`text-sm font-medium ${textPrimary}`}>
                  {readings.length > 0
                    ? format(new Date(readings[readings.length - 1].timestamp), 'dd.MM.yyyy HH:mm:ss')
                    : '--'}
                </div>
              </div>

              {/* Refresh Progress Ring */}
              <div className="relative w-12 h-12">
                <svg className="w-12 h-12 transform -rotate-90">
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    className={darkMode ? 'text-gray-700' : 'text-gray-300'}
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 20}`}
                    strokeDashoffset={`${2 * Math.PI * 20 * (1 - progress / 100)}`}
                    className={darkMode ? 'text-blue-400' : 'text-blue-600'}
                    style={{ transition: 'stroke-dashoffset 1s linear' }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" className={darkMode ? 'text-gray-300' : 'text-gray-600'} />
                  </svg>
                </div>
              </div>

              {/* Dark Mode Toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-3 rounded-xl bg-white/20 dark:bg-gray-700/50 hover:bg-white/30 dark:hover:bg-gray-600/50 transition-all duration-200 backdrop-blur-sm border border-white/30 dark:border-gray-600"
                aria-label="Toggle dark mode"
              >
                {darkMode ? (
                  <svg className="w-6 h-6 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-purple-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>

              {/* Status */}
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-sm border ${
                isOnline
                  ? 'bg-green-500/20 dark:bg-green-400/20 border-green-400/30'
                  : 'bg-red-500/20 dark:bg-red-400/20 border-red-400/30'
              }`}>
                <span className="relative flex h-3 w-3">
                  {isOnline && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  )}
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${
                    isOnline ? 'bg-green-500' : 'bg-red-500'
                  }`}></span>
                </span>
                <span className={`font-semibold text-sm ${
                  isOnline
                    ? 'text-green-100 dark:text-green-300'
                    : 'text-red-100 dark:text-red-300'
                }`}>
                  {isOnline ? 'Live' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          {stats && (
            <>
              {/* Current Temperature - Highlighted */}
              <div className={`backdrop-blur-lg bg-gradient-to-br rounded-2xl p-6 shadow-2xl border-2 hover:scale-105 transition-transform duration-200 ${
                darkMode
                  ? 'from-pink-600/30 to-rose-600/30 border-pink-500/50'
                  : 'from-pink-100 to-rose-100 border-pink-300'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className={`text-sm font-medium mb-2 uppercase tracking-wide ${
                      darkMode ? 'text-pink-200' : 'text-pink-700'
                    }`}>
                      Temperatur
                    </div>
                    <div className={`text-4xl font-bold flex items-baseline gap-2 ${
                      darkMode ? 'text-gray-100' : 'text-gray-900'
                    }`}>
                      {readings[readings.length - 1]?.temperature.toFixed(1) || '--'}
                      <span className="text-2xl">°C</span>
                    </div>
                    {readings.length > 0 && (
                      <div className={`text-xs mt-1 ${textSecondary}`}>
                        {format(new Date(readings[readings.length - 1].timestamp), 'dd.MM.yyyy HH:mm')}
                      </div>
                    )}
                    {readings.length > 1 && (
                      <div className="mt-1 text-2xl">
                        {readings[readings.length - 1]?.temperature > readings[readings.length - 2]?.temperature ? '↑' : '↓'}
                      </div>
                    )}
                  </div>
                  <div className="text-4xl">🌡️</div>
                </div>
              </div>

              {/* Current Humidity - Highlighted */}
              <div className={`backdrop-blur-lg bg-gradient-to-br rounded-2xl p-6 shadow-2xl border-2 hover:scale-105 transition-transform duration-200 ${
                darkMode
                  ? 'from-blue-600/30 to-cyan-600/30 border-blue-500/50'
                  : 'from-blue-100 to-cyan-100 border-blue-300'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className={`text-sm font-medium mb-2 uppercase tracking-wide ${
                      darkMode ? 'text-blue-200' : 'text-blue-700'
                    }`}>
                      Luftfeuchtigkeit
                    </div>
                    <div className={`text-4xl font-bold flex items-baseline gap-2 ${
                      darkMode ? 'text-gray-100' : 'text-gray-900'
                    }`}>
                      {(readings.length > 0 && readings[readings.length - 1]?.humidity !== null && readings[readings.length - 1]?.humidity !== undefined)
                        ? readings[readings.length - 1].humidity!.toFixed(1)
                        : '--'}
                      <span className="text-2xl">%</span>
                    </div>
                    {readings.length > 0 && (
                      <div className={`text-xs mt-1 ${textSecondary}`}>
                        {format(new Date(readings[readings.length - 1].timestamp), 'dd.MM.yyyy HH:mm')}
                      </div>
                    )}
                    {readings.length > 1 &&
                     readings[readings.length - 1]?.humidity !== null &&
                     readings[readings.length - 2]?.humidity !== null && (
                      <div className="mt-1 text-2xl">
                        {readings[readings.length - 1].humidity! > readings[readings.length - 2].humidity! ? '↑' : '↓'}
                      </div>
                    )}
                  </div>
                  <div className="text-4xl">💧</div>
                </div>
              </div>

              {/* Average */}
              <div className={`backdrop-blur-lg rounded-2xl p-6 shadow-xl border hover:scale-105 transition-transform duration-200 ${cardBg}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className={`text-sm font-medium mb-2 uppercase tracking-wide ${textSecondary}`}>
                      Ø Temperatur
                    </div>
                    <div className={`text-3xl font-bold ${textPrimary}`}>
                      {stats.avg_temp ? stats.avg_temp.toFixed(1) : '--'}°C
                    </div>
                  </div>
                  <div className="text-4xl">📊</div>
                </div>
              </div>

              {/* Minimum */}
              <div className={`backdrop-blur-lg rounded-2xl p-6 shadow-xl border hover:scale-105 transition-transform duration-200 ${cardBg}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className={`text-sm font-medium mb-2 uppercase tracking-wide ${textSecondary}`}>
                      Minimum
                    </div>
                    <div className={`text-3xl font-bold ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                      {minReading && minReading.temperature !== Infinity ? minReading.temperature.toFixed(1) : '--'}°C
                    </div>
                    {minReading && minReading.temperature !== Infinity && (
                      <div className={`text-xs mt-1 ${textSecondary}`}>
                        {format(new Date(minReading.timestamp), 'dd.MM.yyyy HH:mm')}
                      </div>
                    )}
                  </div>
                  <div className="text-4xl">❄️</div>
                </div>
              </div>

              {/* Maximum */}
              <div className={`backdrop-blur-lg rounded-2xl p-6 shadow-xl border hover:scale-105 transition-transform duration-200 ${cardBg}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className={`text-sm font-medium mb-2 uppercase tracking-wide ${textSecondary}`}>
                      Maximum
                    </div>
                    <div className={`text-3xl font-bold ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                      {maxReading && maxReading.temperature !== -Infinity ? maxReading.temperature.toFixed(1) : '--'}°C
                    </div>
                    {maxReading && maxReading.temperature !== -Infinity && (
                      <div className={`text-xs mt-1 ${textSecondary}`}>
                        {format(new Date(maxReading.timestamp), 'dd.MM.yyyy HH:mm')}
                      </div>
                    )}
                  </div>
                  <div className="text-4xl">🔥</div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Time Range Selector */}
        <div className="flex justify-center mb-8">
          <div className={`backdrop-blur-lg rounded-2xl p-4 shadow-xl border ${cardBg}`}>
            <div className="flex flex-wrap items-center gap-3">
              <span className={`font-semibold text-lg mr-2 ${textPrimary}`}>📅 Zeitraum:</span>
              {[
                { label: '1h', value: 1 },
                { label: '6h', value: 6 },
                { label: '24h', value: 24 },
                { label: '7d', value: 168 },
              ].map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => setTimeRange(value)}
                  className={`px-6 py-2.5 rounded-xl font-semibold transition-all duration-200 ${
                    timeRange === value
                      ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg scale-105'
                      : buttonBg
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className={`backdrop-blur-lg rounded-2xl p-8 shadow-2xl border mb-8 ${cardBg}`}>
          <div className="h-96 lg:h-[500px]">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>

        {/* Footer */}
        <footer className={`backdrop-blur-lg rounded-2xl p-6 shadow-xl border ${cardBg}`}>
          <div className={`flex flex-wrap justify-center items-center gap-8 ${textPrimary}`}>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📈</span>
              <span className="font-medium">{stats?.count || 0} Messwerte</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔄</span>
              <span className="font-medium">Auto-Refresh: 30s</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🖥️</span>
              <span className="font-medium">Raspberry Pi • Sonoff SNZB-02P</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default App
