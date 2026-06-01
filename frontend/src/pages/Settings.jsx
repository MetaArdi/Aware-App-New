import { useNavigate } from 'react-router-dom'
import SideNav from '../components/Layout/SideNav'
import TopBar  from '../components/Layout/TopBar'
import { useAuth } from '../context/AuthContext'

export default function Settings() {
  const { user } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen bg-background">
      <SideNav userName={user?.name} subLabel={user?.division} />
      <div className="flex-1 lg:ml-64 flex flex-col">
        <header className="px-margin-mobile md:px-margin-desktop py-lg border-b border-outline-variant">
          <h1 className="text-headline-lg font-bold text-primary">Settings</h1>
          <p className="text-body-sm text-on-surface-variant">Personalisasi akun dan preferensi aplikasi.</p>
        </header>
        <main className="flex-1 p-margin-mobile md:p-margin-desktop">
          <p className="text-on-surface-variant">Pengaturan akan tampil di sini.</p>
        </main>
      </div>
    </div>
  )
}