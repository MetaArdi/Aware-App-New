import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const NAV_ITEMS = [
  { icon: 'biotech',   label: 'Assessment',  path: '/screening' },
  { icon: 'dashboard', label: 'Dashboard',   path: '/dashboard' },
  { icon: 'history',   label: 'Health Logs', path: '/logs' },
  { icon: 'settings',  label: 'Settings',    path: '/settings' },
]

export default function SideNav({ userName, subLabel }) {
  const navigate   = useNavigate()
  const location   = useLocation()
  const { logout } = useAuth()

  return (
    <aside className="fixed left-0 top-0 h-full hidden lg:flex flex-col py-lg gap-sm
                       border-r border-outline-variant bg-surface w-64 z-40">
      <div className="px-6 mb-lg">
        <h1 className="text-headline-md font-bold text-primary">AWARE</h1>
        <p className="text-body-sm text-on-surface-variant">Industrial Safety</p>
      </div>

      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map(item => {
          const isActive = location.pathname === item.path
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{ width: 'calc(100% - 16px)' }}
              className={`flex items-center gap-md px-4 py-3 mx-2 rounded-lg
                          transition-all duration-200 text-label-md
                          ${isActive
                            ? 'bg-secondary-container text-on-secondary-container'
                            : 'text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="px-4 mt-auto">
        <button
          onClick={() => navigate('/screening')}
          className="w-full bg-primary text-on-primary py-3 rounded-lg font-semibold
                     flex items-center justify-center gap-2 hover:opacity-90 transition-all
                     active:scale-95 text-label-md mb-md"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          New Screening
        </button>

        <div className="flex items-center gap-sm border-t border-outline-variant pt-md">
          <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center">
            <span className="material-symbols-outlined text-primary">person</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-body-sm font-bold text-on-surface truncate">{userName || 'User'}</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider truncate">
              {subLabel || 'Industrial Safety'}
            </p>
          </div>
          <button onClick={logout} title="Keluar" className="hover:opacity-70 transition shrink-0">
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: '18px' }}>logout</span>
          </button>
        </div>
      </div>
    </aside>
  )
}