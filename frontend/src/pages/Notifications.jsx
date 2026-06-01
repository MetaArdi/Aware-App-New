import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import SideNav from '../components/Layout/SideNav'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

export default function Notifications() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedNotif, setSelectedNotif] = useState(null)

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications/')
      setNotifications(res.data)
    } catch (err) {
      console.error("Gagal mengambil notifications", err)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/read`)
      fetchNotifications()
    } catch (err) {
      console.error("Gagal update status", err)
    }
  }

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all')
      fetchNotifications()
    } catch (err) {
      console.error("Gagal update semua", err)
    }
  }

  useEffect(() => {
    fetchNotifications()
    // Polling setiap 30 detik untuk notifikasi baru
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  const formatTime = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + date.toLocaleDateString()
  }

  return (
    <div className="flex min-h-screen bg-background text-on-background">
      <SideNav userName={user?.name} subLabel={user?.division} />
      
      <div className="flex-1 lg:ml-64 flex flex-col">
        <header className="px-margin-mobile md:px-margin-desktop py-lg border-b border-outline-variant flex justify-between items-center">
          <div>
            <h1 className="text-headline-lg font-bold text-primary">NOTIFIKASI</h1>
            <p className="text-body-sm text-on-surface-variant">Pusat informasi keamanan dan aktivitas sistem.</p>
          </div>
          <button 
            onClick={markAllRead}
            className="text-label-md text-secondary hover:underline"
          >
            Tandai semua dibaca
          </button>
        </header>

        <main className="flex-1 p-margin-mobile md:p-margin-desktop">
          {loading ? (
            <div className="flex justify-center py-xl">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-xl bg-surface-container-lowest rounded-2xl border border-dashed border-outline">
              <span className="material-symbols-outlined text-outline text-display-lg">notifications_off</span>
              <p className="mt-md text-on-surface-variant font-medium">Tidak ada notifikasi saat ini.</p>
            </div>
          ) : (
            <div className="max-w-3xl space-y-md">
              {notifications.map(n => (
                <div 
                  key={n.id} 
                  onClick={() => {
                    if (!n.is_read) markAsRead(n.id)
                    if (n.title.includes("Pesan dari Supervisor")) {
                      setSelectedNotif(n)
                    } else if (n.link) {
                      navigate(n.link)
                    }
                  }}
                  className={`p-lg rounded-xl border flex gap-md transition-all cursor-pointer
                    ${n.type === 'error' ? 'border-l-4 border-l-error bg-error-container/5' : 'bg-surface'}
                    ${!n.is_read 
                      ? 'border-secondary/30 shadow-md transform hover:scale-[1.01]' 
                      : 'border-outline-variant opacity-75'}`}
                >
                  <span className={`material-symbols-outlined mt-1 
                    ${!n.is_read ? (n.type === 'error' ? 'text-error' : 'text-secondary') : 'text-on-surface-variant'}`}>
                    {n.type === 'error' ? 'warning' : (!n.is_read ? 'notifications_active' : 'notifications')}
                  </span>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-xs">
                      <h3 className={`text-label-lg font-bold ${!n.is_read ? 'text-primary' : 'text-on-surface'}`}>
                        {n.title}
                      </h3>
                      <span className="text-[10px] text-on-surface-variant uppercase">{formatTime(n.created_at)}</span>
                    </div>
                    <p className="text-body-md text-on-surface-variant mb-md">{n.message}</p>
                    
                    {n.link && (
                      <div className="flex justify-end">
                        <span className={`text-label-sm px-md py-xs rounded-full font-bold flex items-center gap-xs
                          ${!n.is_read ? 'bg-secondary text-on-secondary' : 'bg-outline-variant text-on-surface-variant'}`}>
                          {n.title.includes("Pesan dari Supervisor") ? "BACA PESAN" : "LIHAT DETAIL"}
                          <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Detail Notification Modal */}
      {selectedNotif && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-md backdrop-blur-sm">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in border border-outline-variant">
            <div className="p-lg border-b border-outline-variant flex justify-between items-start bg-primary text-on-primary">
              <div>
                <h3 className="text-headline-sm font-bold flex items-center gap-sm">
                  <span className="material-symbols-outlined">mail</span>
                  ISI PESAN SUPERVISOR
                </h3>
                <p className="text-label-sm opacity-80 mt-1">
                  Dikirim pada {new Date(selectedNotif.created_at).toLocaleString('id-ID')}
                </p>
              </div>
              <button 
                onClick={() => setSelectedNotif(null)} 
                className="p-sm hover:bg-white/10 rounded-full transition"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-xl space-y-xl">
              <div className="bg-surface-container-low p-lg rounded-xl border border-outline-variant italic text-body-lg text-primary leading-relaxed">
                {selectedNotif.message.replace('Supervisor memberikan instruksi: ', '')}
              </div>
              
              <div className="flex flex-col gap-md">
                <button
                  onClick={() => {
                    navigate('/logs');
                    setSelectedNotif(null);
                  }}
                  className="bg-secondary text-on-secondary py-lg rounded-xl font-bold flex items-center justify-center gap-sm hover:brightness-110 active:scale-95 transition shadow-lg"
                >
                  <span className="material-symbols-outlined">history</span>
                  LIHAT GRAFIK KESEHATAN SAYA
                </button>
                <button
                  onClick={() => setSelectedNotif(null)}
                  className="text-on-surface-variant py-md rounded-xl font-bold hover:bg-surface-variant transition"
                >
                  TUTUP
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
