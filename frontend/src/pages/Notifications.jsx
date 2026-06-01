import { useNavigate } from 'react-router-dom'
import SideNav from '../components/Layout/SideNav'
import { useAuth } from '../context/AuthContext'

export default function Notifications() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const notifications = [
    { id: 1, title: 'Screening Keamanan', message: 'Jangan lupa melakukan screening sebelum memulai shift.', time: '2 jam yang lalu', unread: true },
    { id: 2, title: 'Pembaruan Sistem', message: 'Sistem deteksi fatigue kini lebih akurat dengan integrasi MediaPipe.', time: '1 hari yang lalu', unread: false },
  ]

  return (
    <div className="flex min-h-screen bg-background text-on-background">
      <SideNav userName={user?.name} subLabel={user?.division} />
      
      <div className="flex-1 lg:ml-64 flex flex-col">
        <header className="px-margin-mobile md:px-margin-desktop py-lg border-b border-outline-variant">
          <h1 className="text-headline-lg font-bold text-primary">Notifications</h1>
          <p className="text-body-sm text-on-surface-variant">Informasi terbaru mengenai aktivitas dan keamanan Anda.</p>
        </header>

        <main className="flex-1 p-margin-mobile md:p-margin-desktop">
          <div className="max-w-3xl space-y-md">
            {notifications.map(n => (
              <div 
                key={n.id} 
                className={`p-lg rounded-xl border flex gap-md transition-all
                  ${n.unread 
                    ? 'bg-secondary-container/20 border-secondary/30' 
                    : 'bg-surface border-outline-variant'}`}
              >
                <span className={`material-symbols-outlined mt-1 ${n.unread ? 'text-secondary' : 'text-on-surface-variant'}`}>
                  {n.unread ? 'notifications_active' : 'notifications'}
                </span>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-xs">
                    <h3 className={`text-label-lg font-bold ${n.unread ? 'text-primary' : 'text-on-surface'}`}>
                      {n.title}
                    </h3>
                    <span className="text-[10px] text-on-surface-variant uppercase">{n.time}</span>
                  </div>
                  <p className="text-body-sm text-on-surface-variant">{n.message}</p>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}
