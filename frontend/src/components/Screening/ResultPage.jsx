import { useNavigate } from 'react-router-dom'
import { useAuth }     from '../../context/AuthContext'
import SideNav         from '../Layout/SideNav'
import TopBar          from '../Layout/TopBar'

const STATUS_DATA = {
  fit: {
    bg: 'bg-green-100 border-green-200', text: 'text-green-800',
    heading: 'Kondisi Prima',    statusLabel: 'STATUS: FIT',
    badgeBg: 'bg-green-600',     icon: 'check_circle', iconColor: 'text-green-600',
    scoreLabel: 'Optimal',       scoreColor: 'bg-green-600',
    scoreText: 'text-green-600', scoreBg: 'bg-green-200',
    aiInsight: 'Pola detak jantung dan fokus kognitif Anda berada pada level optimal. Kesiapan kerja Anda sangat tinggi hari ini.',
    kognitif: '92%', kardio: '96%', stres: '15%', stresColor: 'text-primary',
    recommendations: [
      { title: 'Peregangan Berkala',  desc: 'Lakukan peregangan otot ringan setiap 2 jam untuk menjaga sirkulasi.',      icon: 'fitness_center' },
      { title: 'Tetap Terhidrasi',    desc: 'Pastikan asupan air minum terjaga sepanjang shift kerja.',                  icon: 'water_drop' },
      { title: 'Gunakan APD Lengkap', desc: 'Patuhi standar keselamatan kerja dengan alat pelindung diri yang sesuai.', icon: 'engineering' },
      { title: 'Postur Ergonomis',    desc: 'Jaga posisi tubuh yang benar saat bekerja untuk mencegah kelelahan fisik.', icon: 'accessibility_new' },
    ]
  },
  at_risk: {
    bg: 'bg-amber-100 border-amber-200', text: 'text-amber-800',
    heading: 'Beresiko Ringan',  statusLabel: 'STATUS: AT RISK',
    badgeBg: 'bg-amber-600',     icon: 'warning', iconColor: 'text-amber-600',
    scoreLabel: 'Hampir Optimal',scoreColor: 'bg-amber-500',
    scoreText: 'text-amber-600', scoreBg: 'bg-amber-200',
    aiInsight: 'Pola detak jantung Anda menunjukkan fluktuasi yang tidak biasa selama tes kognitif. Hal ini biasanya berkaitan dengan asupan kafein berlebih atau kurang tidur.',
    kognitif: '72%', kardio: '85%', stres: '45%', stresColor: 'text-primary',
    recommendations: [
      { title: 'Hidrasi Intensif', desc: 'Minum 500ml air putih dalam 30 menit ke depan untuk memulihkan fokus.',         icon: 'water_drop' },
      { title: 'Istirahat Mikro',  desc: 'Lakukan teknik pernapasan 4-7-8 selama 5 menit sebelum memasuki area kerja.',   icon: 'potted_plant' },
      { title: 'Pantau Lanjutan',  desc: 'Gunakan wearable device Anda untuk memantau detak jantung saat istirahat.',     icon: 'monitor_heart' },
      { title: 'Lapor Supervisor', desc: 'Informasikan kondisi kelelahan ringan Anda ke pengawas shift sebagai prosedur.',icon: 'emergency' },
    ]
  },
  not_fit: {
    bg: 'bg-red-100 border-red-200', text: 'text-red-800',
    heading: 'Tidak Fit',        statusLabel: 'STATUS: NOT FIT',
    badgeBg: 'bg-red-600',       icon: 'cancel', iconColor: 'text-red-600',
    scoreLabel: 'Kritis',        scoreColor: 'bg-red-600',
    scoreText: 'text-red-600',   scoreBg: 'bg-red-200',
    aiInsight: 'PERINGATAN: Kami mendeteksi level kelelahan kritis. Kecepatan reaksi kognitif Anda menurun drastis dibanding data rata-rata.',
    kognitif: '38%', kardio: '82%', stres: '88%', stresColor: 'text-error',
    recommendations: [
      { title: 'Lapor Supervisor',   desc: 'Segera melapor ke supervisor bahwa Anda dalam kondisi tidak fit untuk bekerja.', icon: 'emergency' },
      { title: 'Istirahat Tambahan', desc: 'Ambil waktu istirahat tambahan minimal 2 jam sebelum mulai bekerja.',           icon: 'hotel' },
      { title: 'Konsultasi Medis',   desc: 'Jika gejala kelelahan berlanjut, hubungi tim medis di lokasi proyek.',          icon: 'medical_services' },
      { title: 'Evaluasi Tidur',     desc: 'Pastikan Anda mendapatkan kualitas tidur yang cukup sebelum shift berikutnya.', icon: 'bedtime' },
    ]
  }
}

export default function ResultPage({ result, onRestart }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const d        = STATUS_DATA[result?.status] || STATUS_DATA.at_risk

  // Gunakan risk_score dari API untuk skor aktual
  const actualScore = result?.risk_score != null
    ? Math.round((1 - result.risk_score) * 100)
    : d.score

  const now = new Date().toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col">
      <TopBar title="AWARE" tabs={[
        { label: 'Assessment',  active: true },
        { label: 'Dashboard',   active: false },
        { label: 'Health Logs', active: false },
      ]} />

      <div className="flex flex-1">
        <SideNav userName={user?.name} subLabel="Industrial Safety" />

        <main className="flex-1 lg:ml-64 p-margin-mobile md:p-margin-desktop bg-background pb-32">
          <div className="max-w-4xl mx-auto">

            {/* Header */}
            <section className="mb-xl text-center md:text-left">
              <h1 className="text-headline-lg font-bold text-primary mb-xs">Hasil Screening Kesehatan</h1>
              <p className="text-body-md text-on-surface-variant">Selesai pada {now}</p>
            </section>

            {/* Status Card */}
            <div className={`border rounded-xl p-lg md:p-xl mb-lg shadow-sm ${d.bg}`}>
              <div className="flex flex-col md:flex-row items-center gap-lg">
                <div className="bg-white rounded-full p-6 shadow-md border border-gray-200">
                  <span
                    className={`material-symbols-outlined ${d.iconColor}`}
                    style={{ fontSize: '64px', fontVariationSettings: "'FILL' 1" }}
                  >
                    {d.icon}
                  </span>
                </div>
                <div className="flex-1 text-center md:text-left">
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-white text-label-md mb-sm ${d.badgeBg}`}>
                    {d.statusLabel}
                  </div>
                  <h2 className={`text-display-lg font-bold mb-xs ${d.text}`}>{d.heading}</h2>
                  <p className={`text-body-lg opacity-90 max-w-lg ${d.text}`}>{result?.message || d.aiInsight}</p>
                </div>
              </div>
            </div>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-lg mb-lg">

              {/* Score */}
              <div className="md:col-span-7 bg-surface-container-lowest border border-outline-variant rounded-xl p-lg flex flex-col justify-between">
                <div>
                  <h3 className="text-headline-md font-bold text-primary mb-md">Skor Kesiapan Kerja</h3>
                  <div className="relative pt-1">
                    <div className="flex mb-2 items-center justify-between">
                      <span className={`text-xs font-bold inline-block py-1 px-2 uppercase rounded-full ${d.scoreBg} ${d.scoreText}`}>
                        Skor: {actualScore}/100
                      </span>
                      <span className={`text-xs font-bold ${d.scoreText}`}>{d.scoreLabel}</span>
                    </div>
                    <div className="overflow-hidden h-4 mb-4 rounded-full bg-surface-container-high">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${d.scoreColor}`}
                        style={{ width: `${actualScore}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-md text-center mt-lg">
                  <div className="p-sm">
                    <p className="text-label-md text-on-surface-variant mb-xs">Kognitif</p>
                    <p className="text-headline-md font-bold text-primary">{d.kognitif}</p>
                  </div>
                  <div className="p-sm border-x border-outline-variant">
                    <p className="text-label-md text-on-surface-variant mb-xs">Kardio</p>
                    <p className="text-headline-md font-bold text-primary">{d.kardio}</p>
                  </div>
                  <div className="p-sm">
                    <p className="text-label-md text-on-surface-variant mb-xs">Stres</p>
                    <p className={`text-headline-md font-bold ${d.stresColor}`}>{d.stres}</p>
                  </div>
                </div>
              </div>

              {/* AI Insight */}
              <div className="md:col-span-5 bg-primary text-on-primary rounded-xl p-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-lg opacity-10">
                  <span className="material-symbols-outlined" style={{ fontSize: '120px' }}>psychology</span>
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-xs mb-md">
                    <span
                      className="material-symbols-outlined"
                      style={{ color: '#39b8fd', fontVariationSettings: "'FILL' 1" }}
                    >auto_awesome</span>
                    <span className="text-label-md font-bold uppercase tracking-widest" style={{ color: '#39b8fd' }}>
                      AI Insight
                    </span>
                  </div>
                  <p className="text-body-md leading-relaxed">{d.aiInsight}</p>
                </div>
              </div>
            </div>

            {/* Rekomendasi */}
            <section className="bg-surface-container-low rounded-xl border border-outline-variant p-lg md:p-xl mb-lg">
              <div className="flex items-center gap-sm mb-lg">
                <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  clinical_notes
                </span>
                <h3 className="text-headline-md font-bold text-primary">Rekomendasi Kesehatan</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                {d.recommendations.map((rec, i) => (
                  <div key={i} className="bg-surface-container-lowest p-md rounded-lg border border-outline-variant flex gap-md">
                    <div className="w-12 h-12 rounded-lg bg-secondary-container/20 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-secondary">{rec.icon}</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-primary mb-xs">{rec.title}</h4>
                      <p className="text-body-sm text-on-surface-variant">{rec.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Actions */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-md pt-lg">
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full md:w-auto px-xl py-md bg-primary text-on-primary rounded-lg
                           font-bold flex items-center justify-center gap-sm hover:opacity-90 transition-all"
              >
                <span className="material-symbols-outlined">dashboard</span>
                Kembali ke Dashboard
              </button>
              <button
                onClick={onRestart}
                className="w-full md:w-auto px-xl py-md border-2 border-secondary text-secondary
                           rounded-lg font-bold flex items-center justify-center gap-sm
                           hover:bg-secondary-container/10 transition-all"
              >
                <span className="material-symbols-outlined">restart_alt</span>
                Mulai Ulang Screening
              </button>
            </div>

          </div>
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <footer className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface-container-low
                          border-t border-outline-variant px-margin-mobile py-sm
                          flex justify-around items-center z-50">
        {[
          { icon: 'biotech',   label: 'Assess',   active: true },
          { icon: 'dashboard', label: 'Dash',     active: false },
          { icon: 'history',   label: 'Logs',     active: false },
          { icon: 'settings',  label: 'Settings', active: false },
        ].map(item => (
          <div key={item.label} className={`flex flex-col items-center gap-xs
            ${item.active ? 'text-secondary font-bold' : 'text-on-surface-variant'}`}>
            <span className="material-symbols-outlined">{item.icon}</span>
            <span className="text-[10px] uppercase tracking-tighter">{item.label}</span>
          </div>
        ))}
      </footer>
    </div>
  )
}