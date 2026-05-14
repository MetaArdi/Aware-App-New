import SideNav from '../components/Layout/SideNav'
import TopBar  from '../components/Layout/TopBar'
import { useAuth } from '../context/AuthContext'

export default function HealthLogs() {
  const { user } = useAuth()
  return (
    <div className="flex min-h-screen bg-background">
      <SideNav userName={user?.name} />
      <div className="flex-1 lg:ml-64 flex flex-col">
        <TopBar title="Health Logs" />
        <main className="flex-1 p-6">
          <p className="text-on-surface-variant">Riwayat kesehatan akan tampil di sini.</p>
        </main>
      </div>
    </div>
  )
}