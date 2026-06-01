import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const NAV_ITEMS = [
  { icon: 'biotech',      label: 'Assessment',   path: '/screening' },
  { icon: 'dashboard',    label: 'Dashboard',    path: '/dashboard' },
  { icon: 'notifications', label: 'Notifications', path: '/notifications' },
  { icon: 'history',      label: 'Health Logs',  path: '/logs' },
  { icon: 'settings',     label: 'Settings',     path: '/settings' },
]

export default function SideNav({ userName, subLabel }) {
  const navigate   = useNavigate()
  const location   = useLocation()
  const { logout, user } = useAuth()

  // Sembunyikan Dashboard jika bukan admin/supervisor, sembunyikan Screening jika bukan employee
  const items = NAV_ITEMS.filter(item => {
    if (item.path === '/dashboard' && !['admin', 'supervisor'].includes(user?.role)) return false
    if (item.path === '/screening' && user?.role !== 'employee') return false
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
              {item.path === '/notifications' && (
                <span className="absolute right-4 w-2 h-2 bg-error rounded-full border border-surface"></span>
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