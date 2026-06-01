import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/axios'

const NAV_ITEMS = [
  { icon: 'dashboard',    label: 'Dashboard',    path: '/dashboard' },
  { icon: 'biotech',      label: 'Assessment',   path: '/screening' },
  { icon: 'notifications', label: 'Notifications', path: '/notifications' },
  { icon: 'history',      label: 'Health Logs',  path: '/logs' },
  { icon: 'settings',     label: 'Settings',     path: '/settings' },
]

export default function SideNav({ userName, subLabel }) {
  const navigate   = useNavigate()
  const location   = useLocation()
  const { logout, user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchUnreadCount = async () => {
    try {
      const res = await api.get('/notifications/')
      const unread = res.data.filter(n => !n.is_read).length
      setUnreadCount(unread)
    } catch (err) {
      // silent fail
    }
  }

  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [])

  // Filter nav items based on user role
  const items = NAV_ITEMS.filter(item => {
    // Dashboard hanya untuk admin/supervisor
    if (item.path === '/dashboard' && !['admin', 'supervisor'].includes(user?.role)) return false
    
    // Screening (Assessment) terbuka untuk employee, 
    // juga untuk supervisor/admin agar mereka bisa melakukan self-screening
    if (item.path === '/screening' && !['employee', 'supervisor', 'admin'].includes(user?.role)) return false
    
    return true
  })

  // Tambahkan menu ML Sandbox jika admin
  if (user?.role === 'admin') {
    items.push({ icon: 'terminal', label: 'ML Sandbox', path: '/ml-sandbox' })
  }

  return (
    <aside className="fixed left-0 top-0 h-full hidden lg:flex flex-col py-lg gap-sm
                       border-r border-outline-variant bg-surface w-64 z-40">
      <div className="px-6 mb-lg">
        <h1 className="text-headline-md font-bold text-primary">AWARE</h1>
        <p className="text-body-sm text-on-surface-variant">Industrial Safety</p>
      </div>

      <nav className="flex-1 space-y-1">
        {items.map(item => {
          const isActive = location.pathname === item.path
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{ width: 'calc(100% - 16px)' }}
              className={`flex items-center gap-md px-4 py-3 mx-2 rounded-lg
                          transition-all duration-200 text-label-md relative
                          ${isActive
                            ? 'bg-secondary-container text-on-secondary-container font-bold'
                            : 'text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              {item.label}
              {item.path === '/notifications' && unreadCount > 0 && (
                <span className="absolute right-4 min-w-[18px] h-[18px] bg-error text-on-error text-[10px] 
                                  flex items-center justify-center rounded-full border border-surface px-1 font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="px-4 mt-auto">
        <div className="flex items-center gap-sm border-t border-outline-variant pt-md">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">person</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-body-sm font-bold text-on-surface truncate">{userName || 'User'}</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider truncate">
              {user?.division || subLabel || 'Industrial Safety'}
            </p>
          </div>
          <div className="flex items-center gap-xs">
            <button onClick={logout} title="Keluar" className="p-1 hover:bg-surface-container-high rounded-full transition">
              <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: '20px' }}>logout</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}