import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SideNav from '../components/Layout/SideNav'
import { useAuth } from '../context/AuthContext'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../api/axios'

export default function HealthLogs() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const targetId = user?.employee_id
    if (targetId) {
      api.get(`/screening/history/${targetId}`)
        .then(r => setHistory(r.data))
        .catch(err => console.error("Gagal memuat Health Logs:", err))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [user])

  const chartData = history.slice().reverse().map(h => ({
    date:       new Date(h.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
    'Risk %':   +(h.risk_score    * 100).toFixed(1),
    'Fatigue %':+(h.fatigue_score * 100).toFixed(1),
  }))

  return (
    <div className="flex min-h-screen bg-background text-on-background">
      <SideNav userName={user?.name} subLabel={user?.division} />
      <div className="flex-1 lg:ml-64 flex flex-col">
        <header className="px-margin-mobile md:px-margin-desktop py-lg border-b border-outline-variant bg-white sticky top-0 z-10">
          <h1 className="text-headline-lg font-bold text-primary">Health Logs</h1>
          <p className="text-body-sm text-on-surface-variant">Pantau tren kebugaran dan riwayat screening Anda.</p>
        </header>
        
        <main className="flex-1 p-margin-mobile md:p-margin-desktop space-y-lg">
          {loading ? (
             <div className="flex items-center justify-center py-xl">
               <div className="w-10 h-10 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin" />
             </div>
          ) : history.length > 0 ? (
            <>
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm p-lg transition-all hover:shadow-md">
                <h3 className="text-headline-sm font-bold text-primary mb-md">Grafik Tren Kesehatan Saya</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5eeff" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Line type="monotone" dataKey="Risk %"    stroke="#ba1a1a" strokeWidth={3} dot={{ r: 4, fill: '#ba1a1a' }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="Fatigue %" stroke="#006591" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden transition-all hover:shadow-md">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-surface-container-low">
                        {['TANGGAL', 'STATUS', 'RISK', 'CATATAN SUPERVISOR'].map(h => (
                          <th key={h} className="px-lg py-md text-label-md text-on-surface-variant font-bold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant">
                      {history.map((h, i) => (
                        <tr key={i} className="hover:bg-surface-bright transition-colors">
                          <td className="px-lg py-sm text-body-sm font-medium">
                            {new Date(h.date).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })}
                          </td>
                          <td className="px-lg py-sm">
                            <span className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-wider
                              ${h.status === 'fit' ? 'bg-green-100 text-green-700' : 
                                h.status === 'at_risk' ? 'bg-amber-100 text-amber-700' :
                                'bg-error-container text-error'}`}>
                              {h.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-lg py-sm text-body-sm font-bold">{(h.risk_score*100).toFixed(0)}%</td>
                          <td className="px-lg py-sm text-body-sm text-secondary italic max-w-xs truncate" title={h.supervisor_note}>
                            {h.supervisor_note || '–'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 bg-surface-container-lowest rounded-2xl border border-dashed border-outline-variant">
              <span className="material-symbols-outlined text-outline-variant text-[64px] mb-md select-none">analytics</span>
              <p className="text-on-surface-variant font-medium">Belum ada riwayat screening kesehatan untuk saat ini.</p>
              <button 
                onClick={() => navigate('/screening')}
                className="mt-lg bg-primary text-on-primary px-xl py-sm rounded-full font-bold hover:shadow-lg transition active:scale-95"
              >
                MULAI SCREENING PERTAMA
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
