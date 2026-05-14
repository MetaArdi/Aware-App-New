import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth }     from '../context/AuthContext'
import SideNav         from '../components/Layout/SideNav'
import api             from '../api/axios'

export default function Dashboard() {
  const { user }                  = useAuth()
  const navigate                  = useNavigate()
  const [summary, setSummary]     = useState(null)
  const [employees, setEmployees] = useState([])
  const [filter, setFilter]       = useState('Semua Status')
  const [loading, setLoading]     = useState(true)
  const [activeTab, setActiveTab]     = useState('Overview')
  const [activeChart, setActiveChart] = useState('Mingguan')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [sumRes, empRes] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/employees/status')
      ])
      setSummary(sumRes.data)
      setEmployees(empRes.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 60_000)
    return () => clearInterval(interval)
  }, [fetchAll])

  const filteredEmp = employees.filter(e => {
    if (filter === 'Semua Status') return true
    if (filter === 'Fit')     return e.status === 'fit'
    if (filter === 'Not Fit') return e.status === 'not_fit'
    if (filter === 'Warning') return e.status === 'at_risk'
    return true
  })

  const watchlist = employees
    .filter(e => e.status === 'not_fit' || e.status === 'at_risk')
    .slice(0, 3)

  const fitPercent = summary
    ? Math.round((summary.fit / Math.max(summary.screened_today, 1)) * 100)
    : 0

  const weeklyData = [
    { label:'Sen', h:128 }, { label:'Sel', h:192 }, { label:'Rab', h:160 },
    { label:'Kam', h:224, active:true }, { label:'Jum', h:176 },
    { label:'Sab', h:144 }, { label:'Min', h:112 },
  ]
  const monthlyData = [
    { label:'M1', h:140 }, { label:'M2', h:180 }, { label:'M3', h:200 },
    { label:'M4', h:160 },
  ]
  const chartData = activeChart === 'Mingguan' ? weeklyData : monthlyData

  return (
    <div className="text-on-background">
      <SideNav userName={user?.name} subLabel="Industrial Safety" />

      <div className="lg:ml-64 flex flex-col min-h-screen">
        {/* TopBar */}
        <header className="bg-surface-container-low text-primary flex justify-between items-center
                            w-full px-margin-mobile md:px-margin-desktop py-sm z-50
                            border-b border-outline-variant sticky top-0">
          <div className="flex items-center gap-md">
            <span className="lg:hidden material-symbols-outlined cursor-pointer">menu</span>
            <h2 className="text-headline-md font-bold tracking-tight text-primary lg:hidden">DASHBOARD</h2>
            <h2 className="text-headline-md font-bold tracking-tight text-primary hidden lg:block">DASHBOARD SUPERVISOR</h2>
          </div>
          <div className="flex items-center gap-lg">
            <div className="hidden md:flex gap-md">
              {['Overview', 'Tim Saya', 'Laporan Keamanan'].map(t => (
                <span
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`text-body-md cursor-pointer pb-1 transition-all
                    ${activeTab === t
                      ? 'text-secondary font-bold border-b-2 border-secondary'
                      : 'text-on-surface-variant hover:bg-surface-container-high px-2 rounded'}`}
                >
                  {t}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-md">
              <span className="material-symbols-outlined cursor-pointer hover:bg-surface-container-high p-2 rounded-full transition-colors">
                notifications
              </span>
              <div className="flex items-center gap-sm">
                <div className="text-right hidden sm:block">
                  <p className="text-label-md text-on-surface">{user?.name || 'Admin Alpha'}</p>
                  <p className="text-[10px] text-on-surface-variant">Shift Alpha-7</p>
                </div>
                <span className="material-symbols-outlined text-primary cursor-pointer" style={{ fontSize: '32px' }}>
                  account_circle
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="p-margin-mobile md:p-margin-desktop space-y-lg">

          {/* Tab: Tim Saya */}
          {activeTab === 'Tim Saya' && (
            <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm">
              <h3 className="text-headline-md font-bold text-primary mb-md">Tim Saya</h3>
              <p className="text-body-sm text-on-surface-variant">Data anggota tim akan tampil di sini.</p>
            </div>
          )}

          {/* Tab: Laporan Keamanan */}
          {activeTab === 'Laporan Keamanan' && (
            <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm">
              <h3 className="text-headline-md font-bold text-primary mb-md">Laporan Keamanan</h3>
              <p className="text-body-sm text-on-surface-variant">Laporan keamanan shift akan tampil di sini.</p>
            </div>
          )}

          {/* Tab: Overview */}
          {activeTab === 'Overview' && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
                <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm">
                  <div className="flex justify-between items-start mb-md">
                    <p className="text-label-md text-on-surface-variant uppercase tracking-wider">Total Screening</p>
                    <span className="material-symbols-outlined text-secondary">assignment_turned_in</span>
                  </div>
                  <p className="text-display-lg font-bold text-primary">{summary?.screened_today ?? '–'}</p>
                  <div className="flex items-center gap-xs mt-sm text-green-600">
                    <span className="material-symbols-outlined text-sm">trending_up</span>
                    <span className="text-body-sm font-semibold">+12% dari kemarin</span>
                  </div>
                </div>

                <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm">
                  <div className="flex justify-between items-start mb-md">
                    <p className="text-label-md text-on-surface-variant uppercase tracking-wider">Jumlah Not Fit</p>
                    <span className="material-symbols-outlined text-error">warning</span>
                  </div>
                  <p className="text-display-lg font-bold text-error">
                    {summary?.not_fit != null ? String(summary.not_fit).padStart(2, '0') : '–'}
                  </p>
                  <div className="flex items-center gap-xs mt-sm text-error">
                    <span className="material-symbols-outlined text-sm">priority_high</span>
                    <span className="text-body-sm font-semibold">Perlu atensi segera</span>
                  </div>
                </div>

                <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm">
                  <div className="flex justify-between items-start mb-md">
                    <p className="text-label-md text-on-surface-variant uppercase tracking-wider">Rerata Kesiapan Tim</p>
                    <span className="material-symbols-outlined text-secondary">analytics</span>
                  </div>
                  <p className="text-display-lg font-bold text-primary">{summary ? `${fitPercent}%` : '–'}</p>
                  <div className="w-full bg-surface-container-high h-2 rounded-full mt-sm overflow-hidden">
                    <div className="bg-secondary h-full rounded-full transition-all" style={{ width: `${fitPercent}%` }} />
                  </div>
                </div>
              </div>

              {/* Chart + Watchlist */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
                <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm flex flex-col">
                  <div className="flex justify-between items-center mb-lg">
                    <h3 className="text-headline-md font-bold text-primary">Tren Kesiapan Kerja</h3>
                    <div className="flex bg-surface-container-low p-1 rounded-lg">
                      {['Mingguan', 'Bulanan'].map(c => (
                        <button
                          key={c}
                          onClick={() => setActiveChart(c)}
                          className={`px-4 py-1 text-label-md rounded-md transition-all
                            ${activeChart === c
                              ? 'bg-surface-container-lowest shadow-sm text-on-surface'
                              : 'text-on-surface-variant hover:bg-surface-container-high'}`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 min-h-[300px] flex items-end justify-between gap-md px-4 pb-4 relative">
                    <div className="absolute inset-0 flex flex-col justify-between py-10 px-4 opacity-10 pointer-events-none">
                      {[0,1,2,3].map(i => <div key={i} className="border-t border-on-surface" />)}
                    </div>
                    {chartData.map(bar => (
                      <div key={bar.label} className="flex flex-col items-center gap-sm group flex-1">
                        <div
                          className={`w-full rounded-t-lg transition-all duration-300
                            ${bar.active ? 'bg-secondary' : 'bg-secondary-container'}`}
                          style={{ height: `${bar.h}px` }}
                        />
                        <span className={`text-label-md text-on-surface-variant ${bar.active ? 'font-bold' : ''}`}>
                          {bar.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm">
                  <h3 className="text-headline-md font-bold text-primary mb-md">Watchlist Karyawan</h3>
                  <p className="text-body-sm text-on-surface-variant mb-lg">
                    {watchlist.length} Karyawan menunjukkan tren penurunan kesiapan dalam 48 jam terakhir.
                  </p>
                  <div className="space-y-md">
                    {watchlist.length > 0 ? watchlist.map(emp => (
                      <div
                        key={emp.employee_id}
                        onClick={() => navigate(`/employee/${emp.employee_id}`)}
                        className="flex items-center gap-md p-md hover:bg-surface-container-low
                                   transition-colors rounded-lg cursor-pointer"
                      >
                        <div className="w-12 h-12 rounded-full bg-surface-container-high
                                         flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-on-surface-variant">person</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-label-md text-on-surface truncate">{emp.name}</p>
                          <p className={`text-body-sm ${emp.status === 'not_fit' ? 'text-error' : 'text-on-tertiary-container'}`}>
                            {emp.status === 'not_fit'
                              ? `Skor Menurun (${Math.round((emp.risk_score || 0) * 100)}%)`
                              : 'Kelelahan Tinggi'}
                          </p>
                        </div>
                        <span className="material-symbols-outlined text-on-surface-variant shrink-0">chevron_right</span>
                      </div>
                    )) : (
                      <p className="text-body-sm text-on-surface-variant text-center py-4">
                        Tidak ada karyawan berisiko hari ini 🎉
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
                <div className="px-lg py-md border-b border-outline-variant flex flex-col md:flex-row
                                 justify-between items-start md:items-center gap-md">
                  <h3 className="text-headline-md font-bold text-primary">Rekap Harian Screening</h3>
                  <div className="flex items-center gap-sm flex-wrap">
                    <span className="text-label-md text-on-surface-variant">Filter Risiko:</span>
                    <select
                      value={filter}
                      onChange={e => setFilter(e.target.value)}
                      className="bg-surface-container-low border border-outline-variant rounded-lg
                                 px-md py-xs text-body-sm focus:ring-2 focus:ring-secondary focus:outline-none"
                    >
                      {['Semua Status', 'Fit', 'Not Fit', 'Warning'].map(o => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                    <button className="flex items-center gap-xs bg-surface-container-high px-md py-xs
                                        rounded-lg text-label-md hover:bg-surface-container-highest transition-all">
                      <span className="material-symbols-outlined text-sm">download</span> Ekspor CSV
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-surface-container-low">
                        {['NAMA', 'WAKTU', 'SKOR RISIKO', 'STATUS', 'TINDAKAN'].map(h => (
                          <th key={h} className="px-lg py-md text-label-md text-on-surface-variant">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant">
                      {loading ? (
                        <tr>
                          <td colSpan={5} className="px-lg py-xl text-center text-on-surface-variant text-body-sm">
                            Memuat data...
                          </td>
                        </tr>
                      ) : filteredEmp.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-lg py-xl text-center text-on-surface-variant text-body-sm">
                            Tidak ada data.
                          </td>
                        </tr>
                      ) : filteredEmp.map(emp => {
                        const score    = Math.round((emp.risk_score || 0) * 100)
                        const isNotFit = emp.status === 'not_fit'
                        const isAtRisk = emp.status === 'at_risk'
                        const isFit    = emp.status === 'fit'
                        const time     = emp.screening_time
                          ? new Date(emp.screening_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
                          : '–'
                        return (
                          <tr key={emp.employee_id} className="hover:bg-surface transition-colors">
                            <td className="px-lg py-md text-body-md text-on-surface">{emp.name}</td>
                            <td className="px-lg py-md text-body-sm text-on-surface-variant">{time}</td>
                            <td className={`px-lg py-md text-body-md font-medium ${isNotFit ? 'text-error' : 'text-on-surface'}`}>
                              {emp.status ? `${score}/100` : '–'}
                            </td>
                            <td className="px-lg py-md">
                              {!emp.status ? (
                                <span className="text-on-surface-variant text-body-sm">Belum screening</span>
                              ) : isFit ? (
                                <span className="inline-flex items-center gap-xs bg-green-100 text-green-800 px-3 py-1 rounded-full text-label-md">
                                  <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span> Fit
                                </span>
                              ) : isNotFit ? (
                                <span className="inline-flex items-center gap-xs bg-error-container text-on-error-container px-3 py-1 rounded-full text-label-md">
                                  <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>cancel</span> Not Fit
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-xs px-3 py-1 rounded-full text-label-md"
                                      style={{ background: '#fadfb8', color: '#271902' }}>
                                  <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>error</span> Warning
                                </span>
                              )}
                            </td>
                            <td className="px-lg py-md">
                              {isNotFit ? (
                                <button className="bg-error text-on-error px-md py-1 rounded text-label-md hover:opacity-90">
                                  Intervensi
                                </button>
                              ) : isAtRisk ? (
                                <button
                                  onClick={() => navigate(`/employee/${emp.employee_id}`)}
                                  className="text-secondary text-label-md font-bold hover:underline"
                                >
                                  Monitor
                                </button>
                              ) : (
                                <button
                                  onClick={() => navigate(`/employee/${emp.employee_id}`)}
                                  className="text-secondary text-label-md font-bold hover:underline"
                                >
                                  Detail
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="px-lg py-md bg-surface-container-low flex justify-between items-center">
                  <p className="text-body-sm text-on-surface-variant">
                    Menampilkan {filteredEmp.length} dari {employees.length} entri
                  </p>
                  <div className="flex gap-sm">
                    <button className="p-2 rounded hover:bg-surface-container-high transition-colors">
                      <span className="material-symbols-outlined">chevron_left</span>
                    </button>
                    <button className="p-2 rounded bg-primary text-on-primary">1</button>
                    <button className="p-2 rounded hover:bg-surface-container-high">2</button>
                    <button className="p-2 rounded hover:bg-surface-container-high">3</button>
                    <button className="p-2 rounded hover:bg-surface-container-high transition-colors">
                      <span className="material-symbols-outlined">chevron_right</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}