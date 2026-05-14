import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../api/axios'

export default function EmployeeDetail() {
  const { id }                = useParams()
  const navigate              = useNavigate()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    api.get(`/screening/history/${id}`)
      .then(r => setHistory(r.data))
      .catch(() => setError('Gagal memuat riwayat screening.'))
      .finally(() => setLoading(false))
  }, [id])

  const chartData = history.slice().reverse().map(h => ({
    date:       new Date(h.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
    'Risk %':   +(h.risk_score    * 100).toFixed(1),
    'Fatigue %':+(h.fatigue_score * 100).toFixed(1),
  }))

  return (
    <div className="min-h-screen bg-background text-on-background">
      <header className="bg-primary text-on-primary px-margin-mobile md:px-margin-desktop py-sm
                          flex items-center gap-md shadow sticky top-0 z-50">
        <button
          onClick={() => navigate(-1)}
          className="text-primary-fixed hover:text-on-primary transition p-sm
                     hover:bg-white/10 rounded-full"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-headline-md font-bold">Detail Karyawan</h1>
      </header>

      <main className="max-w-3xl mx-auto px-margin-mobile md:px-margin-desktop py-xl space-y-lg">
        {loading ? (
          <div className="flex items-center justify-center py-xl">
            <div className="w-10 h-10 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-error-container text-error rounded-xl p-lg text-center">
            {error}
          </div>
        ) : (
          <>
            {/* Trend Chart */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm p-lg">
              <h3 className="text-headline-md font-bold text-primary mb-md">Tren Risk &amp; Fatigue Score</h3>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5eeff" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: '#ffffff',
                        border: '1px solid #c5c6cd',
                        borderRadius: '8px'
                      }}
                    />
                    <Line type="monotone" dataKey="Risk %"    stroke="#ba1a1a" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Fatigue %" stroke="#006591" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-body-sm text-on-surface-variant text-center py-lg">
                  Belum ada data riwayat untuk ditampilkan.
                </p>
              )}
            </div>

            {/* History Table */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
              <div className="p-lg border-b border-outline-variant">
                <h3 className="text-headline-md font-bold text-primary">
                  Riwayat Screening ({history.length} data)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-surface-container-low">
                      {['TANGGAL', 'STATUS', 'RISK', 'TIDUR', 'ENERGI'].map(h => (
                        <th key={h} className="px-lg py-md text-label-md text-on-surface-variant">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {history.map((h, i) => (
                      <tr key={i} className="hover:bg-surface transition-colors">
                        <td className="px-lg py-md text-body-sm text-on-surface-variant">
                          {new Date(h.date).toLocaleDateString('id-ID', {
                            day: '2-digit', month: 'short', year: 'numeric'
                          })}
                        </td>
                        <td className="px-lg py-md">
                          <span className={`px-2 py-1 rounded-full text-label-md font-bold
                            ${h.status === 'fit'      ? 'bg-green-100 text-green-700' :
                              h.status === 'at_risk'  ? 'bg-amber-100 text-amber-700' :
                                                        'bg-error-container text-error'}`}>
                            {h.status === 'fit' ? 'Fit' : h.status === 'at_risk' ? 'At Risk' : 'Not Fit'}
                          </span>
                        </td>
                        <td className="px-lg py-md text-body-sm text-on-surface">
                          {(h.risk_score * 100).toFixed(0)}%
                        </td>
                        <td className="px-lg py-md text-body-sm text-on-surface-variant">
                          {h.sleep_hours ?? '–'} jam
                        </td>
                        <td className="px-lg py-md text-body-sm text-on-surface-variant">
                          {h.energy_level ?? '–'}/5
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}