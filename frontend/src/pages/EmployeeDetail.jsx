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
  const [saving, setSaving]   = useState(false)
  const [note, setNote]       = useState('')

  const fetchHistory = () => {
    setLoading(true)
    api.get(`/screening/history/${id}`)
      .then(r => setHistory(r.data))
      .catch(() => setError('Gagal memuat riwayat screening.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchHistory()
  }, [id])

  const handleSaveNote = (screeningId) => {
    if (!note.trim()) return
    setSaving(true)
    api.post(`/screening/${screeningId}/note`, { note })
      .then(() => {
        alert('Instruksi berhasil dikirim ke karyawan!')
        setNote('')
        fetchHistory()
      })
      .catch(() => alert('Gagal menyimpan catatan.'))
      .finally(() => setSaving(false))
  }

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
            {/* Urgent Alert Section (If Latest is Not Fit) */}
            {history[0]?.status === 'not_fit' && (
              <div className="bg-error-container text-on-error-container border-2 border-error p-lg rounded-xl shadow-lg animate-pulse-slow">
                <div className="flex items-start gap-md mb-md">
                  <span className="material-symbols-outlined text-headline-lg">warning</span>
                  <div>
                    <h3 className="text-headline-sm font-bold">Karyawan Perlu Intervensi!</h3>
                    <p className="text-body-md">Deteksi tingkat kelelahan tinggi ({ (history[0].risk_score*100).toFixed(0) }%). Silakan berikan instruksi kepada karyawan.</p>
                  </div>
                </div>

                <div className="bg-white/50 p-md rounded-lg space-y-sm">
                  <label className="text-label-sm font-bold block mb-1">CATATAN SUPERVISOR / INSTRUKSI</label>
                  <textarea
                    className="w-full bg-white border border-outline p-md rounded-md text-body-md focus:ring-2 focus:ring-primary outline-none"
                    placeholder="Contoh: Berikan istirahat 15 menit, minta minum air putih..."
                    rows={3}
                    value={note || history[0].supervisor_note || ''}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <div className="flex justify-end gap-md pt-sm">
                    <button
                      disabled={saving || !note}
                      onClick={() => handleSaveNote(history[0].id)}
                      className="bg-primary text-on-primary px-xl py-sm rounded-full font-bold
                                hover:shadow-md active:scale-95 transition disabled:opacity-50 w-full"
                    >
                      {saving ? 'Menyimpan...' : 'KIRIM INSTRUKSI KE KARYAWAN'}
                    </button>
                  </div>
                </div>
              </div>
            )}

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
                      {['TANGGAL', 'STATUS', 'RISK', 'TIDUR', 'ENERGI', 'CATATAN'].map(h => (
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
                        <td className="px-lg py-md text-body-sm text-primary italic max-w-[150px] truncate">
                          {h.supervisor_note || '–'}
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