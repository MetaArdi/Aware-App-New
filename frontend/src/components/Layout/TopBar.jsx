import { useAuth } from '../../context/AuthContext'

export default function TopBar({ title, tabs }) {
  const { user, logout } = useAuth()

  return (
    <header className="bg-surface-container-low text-primary flex justify-between items-center
                        w-full px-margin-mobile md:px-margin-desktop py-sm z-50
                        border-b border-outline-variant sticky top-0">
      <div className="flex items-center gap-md">
        <span className="lg:hidden material-symbols-outlined cursor-pointer">menu</span>
        <h2 className="text-headline-md font-bold tracking-tight text-primary lg:hidden">{title}</h2>
        {tabs && (
          <nav className="hidden md:flex gap-lg ml-xl">
            {tabs.map(t => (
              <span
                key={t.label}
                className={`text-body-md cursor-pointer pb-1
                  ${t.active
                    ? 'text-secondary font-bold border-b-2 border-secondary'
                    : 'text-on-surface-variant hover:bg-surface-container-high px-2 rounded'}`}
              >
                {t.label}
              </span>
            ))}
          </nav>
        )}
      </div>

      <div className="flex items-center gap-md">
        <button className="p-sm hover:bg-surface-container-high rounded-full transition-colors">
          <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
        </button>
        <div className="flex items-center gap-sm">
          <div className="text-right hidden sm:block">
            <p className="text-label-md text-on-surface">{user?.name || 'User'}</p>
            <p className="text-[10px] text-on-surface-variant">Industrial Safety</p>
          </div>
          <button onClick={logout} title="Keluar" className="hover:opacity-80 transition">
            <span className="material-symbols-outlined text-primary cursor-pointer" style={{ fontSize: '32px' }}>
              account_circle
            </span>
          </button>
        </div>
      </div>
    </header>
  )
}