import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login }               = useAuth()
  const [role, setRole]         = useState('employee')
  const [idNumber, setIdNumber] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [showForgotModal, setShowForgotModal]   = useState(false)
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  const [showTermsModal, setShowTermsModal]     = useState(false)
  const [showK3Modal, setShowK3Modal]           = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(idNumber, password)
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        'ID atau kata sandi salah. Silakan coba lagi.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col">
      <main className="flex-grow flex flex-col lg:flex-row">

        {/* Brand Panel */}
        <section className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-primary items-center justify-center p-margin-desktop">
          <div className="absolute inset-0 opacity-40">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuB3u6hCcPHzpUDKf51GEbyfIMy68x03z2YA4azOjjsEVRjWlL1k8Dace7eFo3elXTZ-Jfj4jku2bxN-KHAkZb3nRiN9-KWwTshB_C4WtekKvDArTAJE73zlPDCVN_AWXIoKyZ7AI28qgkJQOcD74MkkrPWN9WevAaN0-SqAclMkb3ioreVXhSgar663xaKbb8pl09D-7UPWinM5e4WSClGTBNYRIbBUbPhIjTEJzK647N7lXi9MYZtu5yVYnGpuWbhEtVa75kcvb3wr"
              alt="Industrial Safety"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="relative z-10 max-w-lg text-on-primary">
            <div className="mb-xl">
              <span className="text-display-lg font-bold tracking-tight">AWARE</span>
              <p className="text-headline-md mt-sm" style={{ color: '#d8e3fb' }}>
                Industrial Health &amp; Safety Intelligence
              </p>
            </div>
            <div className="space-y-lg">
              <div className="flex items-start gap-md">
                <span className="material-symbols-outlined text-[32px]" style={{ color: '#39b8fd' }}>verified_user</span>
                <div>
                  <h3 className="text-body-lg font-bold">Autentikasi Terenkripsi</h3>
                  <p className="text-body-md opacity-80">Sistem keamanan tingkat tinggi untuk melindungi data operasional dan kesehatan personel.</p>
                </div>
              </div>
              <div className="flex items-start gap-md">
                <span className="material-symbols-outlined text-[32px]" style={{ color: '#39b8fd' }}>biotech</span>
                <div>
                  <h3 className="text-body-lg font-bold">Diagnostik Real-time</h3>
                  <p className="text-body-md opacity-80">Pantau kondisi keselamatan kerja melalui integrasi AI yang akurat dan terpercaya.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-1/3 bg-gradient-to-t from-primary to-transparent opacity-60" />
        </section>

        {/* Form Panel */}
        <section className="flex-grow flex flex-col items-center justify-center p-margin-mobile md:p-margin-desktop bg-surface">
          <div className="w-full max-w-md">

            {/* Mobile Logo */}
            <div className="lg:hidden mb-xl text-center">
              <h1 className="text-display-lg font-bold text-primary tracking-tight">AWARE</h1>
              <p className="text-label-md text-secondary uppercase tracking-widest mt-xs">Safety First Environment</p>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm">
              <div className="mb-lg">
                <h2 className="text-headline-md font-bold text-on-background">Selamat Datang</h2>
                <p className="text-body-sm text-on-surface-variant">Silakan masuk untuk mengakses dasbor keselamatan industri Anda.</p>
              </div>

              {/* Role Switcher */}
              <div className="flex bg-surface-container-low p-xs rounded-lg mb-lg">
                <button
                  type="button"
                  onClick={() => setRole('employee')}
                  className={`flex-1 py-sm px-md text-label-md rounded-md transition-all
                    ${role === 'employee'
                      ? 'bg-secondary text-on-secondary'
                      : 'text-on-surface-variant hover:bg-surface-container-high'}`}
                >
                  Karyawan
                </button>
                <button
                  type="button"
                  onClick={() => setRole('supervisor')}
                  className={`flex-1 py-sm px-md text-label-md rounded-md transition-all
                    ${role === 'supervisor'
                      ? 'bg-secondary text-on-secondary'
                      : 'text-on-surface-variant hover:bg-surface-container-high'}`}
                >
                  Supervisor
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-md">
                <div>
                  <label className="block text-label-md text-on-surface mb-xs" htmlFor="id-number">
                    Nomor ID {role === 'supervisor' ? 'Supervisor' : 'Karyawan'}
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-outline" style={{ fontSize: '20px' }}>badge</span>
                    <input
                      id="id-number"
                      type="text"
                      value={idNumber}
                      onChange={e => setIdNumber(e.target.value)}
                      placeholder={role === 'supervisor' ? 'Contoh: SV-2023-001' : 'Contoh: AW-2023-001'}
                      className="w-full pl-xl pr-md py-md bg-surface border border-outline-variant rounded-lg
                                 focus:ring-2 focus:ring-secondary focus:border-secondary transition-all
                                 outline-none text-body-md"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-label-md text-on-surface mb-xs" htmlFor="password">
                    Kata Sandi
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-outline" style={{ fontSize: '20px' }}>lock</span>
                    <input
                      id="password"
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Masukkan kata sandi"
                      className="w-full pl-xl pr-xl py-md bg-surface border border-outline-variant rounded-lg
                                 focus:ring-2 focus:ring-secondary focus:border-secondary transition-all
                                 outline-none text-body-md"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-md top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                        {showPass ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between py-xs">
                  <label className="flex items-center gap-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={e => setRemember(e.target.checked)}
                      className="w-4 h-4 rounded border-outline-variant text-secondary focus:ring-secondary"
                    />
                    <span className="text-body-sm text-on-surface-variant">Ingat saya</span>
                  </label>
                  <button type="button" onClick={() => setShowForgotModal(true)}
                          className="text-body-sm font-semibold text-secondary hover:underline">
                    Lupa sandi?
                  </button>
                </div>

                {error && (
                  <div className="bg-error-container text-error text-body-sm rounded-lg px-md py-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-md bg-primary text-on-primary font-bold rounded-lg
                             hover:opacity-90 active:scale-[0.98] transition-all
                             flex items-center justify-center gap-sm mt-lg
                             disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading
                    ? <><div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" /> Memverifikasi...</>
                    : <>Masuk Ke Sistem <span className="material-symbols-outlined">login</span></>
                  }
                </button>
              </form>

              <div className="mt-xl pt-lg border-t border-outline-variant">
                <div className="flex items-center gap-sm p-md bg-surface-container-high rounded-lg border border-outline-variant/30">
                  <span className="material-symbols-outlined text-secondary">info</span>
                  <p className="text-body-sm text-on-surface-variant leading-tight">
                    Mengalami kesulitan akses? Hubungi Admin IT di ekstensi <strong>#441</strong> atau melalui portal dukungan.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-lg flex flex-wrap justify-center gap-md text-label-md text-outline">
              <button type="button" onClick={() => setShowPrivacyModal(true)}
                      className="hover:text-secondary transition-colors">Kebijakan Privasi</button>
              <span className="hidden md:inline">•</span>
              <button type="button" onClick={() => setShowTermsModal(true)}
                      className="hover:text-secondary transition-colors">Syarat Penggunaan</button>
              <span className="hidden md:inline">•</span>
              <button type="button" onClick={() => setShowK3Modal(true)}
                      className="hover:text-secondary transition-colors">Kepatuhan K3</button>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-surface-container-low border-t border-outline-variant px-margin-mobile md:px-margin-desktop py-sm flex justify-between items-center">
        <div className="flex items-center gap-sm">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          <span className="text-label-md text-on-surface-variant uppercase tracking-tighter">System Secure &amp; Online</span>
        </div>
        <div className="flex items-center gap-md">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-body-sm font-semibold text-on-surface">V 2.4.0-Build Alpha</span>
            <span className="text-[10px] text-outline uppercase tracking-widest">Enterprise Edition</span>
          </div>
          <div className="w-10 h-10 flex items-center justify-center bg-surface-container-highest rounded-full">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: '20px' }}>shield</span>
          </div>
        </div>
      </footer>

      {/* Modal Lupa Sandi */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-sm border border-outline-variant shadow-xl">
            <h3 className="text-headline-sm font-bold text-on-surface mb-2">Reset Kata Sandi</h3>
            <p className="text-body-sm text-on-surface-variant mb-4">
              Hubungi Admin IT di ekstensi <strong>#441</strong> atau supervisor Anda untuk mereset kata sandi.
            </p>
            <button onClick={() => setShowForgotModal(false)}
                    className="w-full py-md bg-primary text-on-primary font-bold rounded-lg hover:opacity-90 transition-all">
              Mengerti
            </button>
          </div>
        </div>
      )}

      {/* Modal Kebijakan Privasi */}
      {showPrivacyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-sm border border-outline-variant shadow-xl">
            <h3 className="text-headline-sm font-bold text-on-surface mb-2">Kebijakan Privasi</h3>
            <p className="text-body-sm text-on-surface-variant mb-4">
              Data biometrik dan kesehatan Anda hanya digunakan untuk keperluan penilaian keselamatan kerja.
              Seluruh data dienkripsi dan tidak dibagikan kepada pihak ketiga tanpa persetujuan.
            </p>
            <button onClick={() => setShowPrivacyModal(false)}
                    className="w-full py-md bg-primary text-on-primary font-bold rounded-lg hover:opacity-90 transition-all">
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Modal Syarat Penggunaan */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-sm border border-outline-variant shadow-xl">
            <h3 className="text-headline-sm font-bold text-on-surface mb-2">Syarat Penggunaan</h3>
            <p className="text-body-sm text-on-surface-variant mb-4">
              Sistem AWARE hanya boleh digunakan oleh personel yang berwenang. Penyalahgunaan akun
              atau manipulasi data screening merupakan pelanggaran kebijakan perusahaan.
            </p>
            <button onClick={() => setShowTermsModal(false)}
                    className="w-full py-md bg-primary text-on-primary font-bold rounded-lg hover:opacity-90 transition-all">
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Modal Kepatuhan K3 */}
      {showK3Modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-sm border border-outline-variant shadow-xl">
            <h3 className="text-headline-sm font-bold text-on-surface mb-2">Kepatuhan K3</h3>
            <p className="text-body-sm text-on-surface-variant mb-4">
              AWARE dikembangkan sesuai standar Keselamatan dan Kesehatan Kerja (K3) Indonesia
              dan regulasi ILO. Hasil screening bersifat rekomendasi dan tidak menggantikan diagnosis medis profesional.
            </p>
            <button onClick={() => setShowK3Modal(false)}
                    className="w-full py-md bg-primary text-on-primary font-bold rounded-lg hover:opacity-90 transition-all">
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  )
}