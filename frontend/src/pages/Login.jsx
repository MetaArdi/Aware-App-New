import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const [role, setRole] = useState('employee')
  const [idNumber, setIdNumber] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(idNumber, password)
    } catch (err) {
      setError(err.response?.data?.detail || 'ID atau kata sandi salah. Silakan coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col font-['IBM_Plex_Sans'] bg-gradient-to-b from-[#F8F9FF] to-[#FFFFFF]">
      <main className="flex-grow flex flex-col lg:flex-row">
        
        {/* Brand & Visual Section */}
        <section className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#091426] items-center justify-center p-10">
          <div className="absolute inset-0 opacity-40 bg-[url('https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80')] bg-cover bg-center" />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#091426] to-transparent opacity-60" />
          
          <div className="relative z-10 flex flex-col max-w-md gap-8">
            <div className="flex flex-col gap-2">
              <span className="text-5xl font-bold tracking-tight text-white leading-tight">AWARE</span>
              <p className="text-2xl font-semibold text-[#D8E3FB] leading-snug">
                Industrial Health & Safety Intelligence
              </p>
            </div>
            <div className="flex flex-col gap-6 opacity-90 mt-4">
              <div className="flex items-start gap-4">
                <div className="w-5 h-6 bg-[#39B8FD] mt-1 shrink-0" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }} />
                <div>
                  <h3 className="text-lg font-bold text-white">Autentikasi Terenkripsi</h3>
                  <p className="text-base text-white opacity-80 mt-1">Sistem keamanan tingkat tinggi untuk melindungi data operasional.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-5 h-6 bg-[#39B8FD] mt-1 shrink-0" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }} />
                <div>
                  <h3 className="text-lg font-bold text-white">Diagnostik Real-time</h3>
                  <p className="text-base text-white opacity-80 mt-1">Pantau kondisi keselamatan kerja melalui integrasi AI yang akurat.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Form Section */}
        <section className="flex-grow flex flex-col items-center justify-center p-6 lg:p-10 bg-[#F8F9FF]">
          <div className="w-full max-w-md flex flex-col gap-6">
            
            {/* Mobile Branding */}
            <div className="lg:hidden text-center mb-6">
              <h1 className="text-4xl font-bold text-[#0B1C30]">AWARE</h1>
              <p className="text-sm text-[#45474C] mt-2">Industrial Health & Safety Intelligence</p>
            </div>

            <div className="bg-white border border-[#C5C6CD] shadow-sm rounded-xl p-6 flex flex-col gap-6">
              <div>
                <h2 className="text-2xl font-semibold text-[#0B1C30] leading-8">Selamat Datang</h2>
                <p className="text-sm text-[#45474C] mt-1">Silakan masuk untuk mengakses dasbor keselamatan industri Anda.</p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-4 bg-[#FFDAD6] border border-[#BA1A1A]/20 rounded-lg">
                  <span className="material-symbols-outlined text-[#BA1A1A] text-sm">error</span>
                  <p className="text-sm font-bold text-[#93000A]">{error}</p>
                </div>
              )}

              {/* Role Switcher */}
              <div className="flex bg-[#EFF4FF] p-1 rounded-lg">
                <button type="button" onClick={() => setRole('employee')}
                  className={`flex-1 py-3 text-xs font-semibold rounded-md text-center transition-all tracking-wider
                    ${role === 'employee' ? 'bg-[#006591] text-white shadow-md' : 'text-[#45474C] hover:bg-black/5'}`}>
                  KARYAWAN
                </button>
                <button type="button" onClick={() => setRole('supervisor')}
                  className={`flex-1 py-3 text-xs font-semibold rounded-md text-center transition-all tracking-wider
                    ${role === 'supervisor' ? 'bg-[#006591] text-white shadow-md' : 'text-[#45474C] hover:bg-black/5'}`}>
                  SUPERVISOR
                </button>
              </div>

              {/* Form Input */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-[#0B1C30] tracking-wider">Nomor ID Karyawan</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#BA1A1A]">badge</span>
                    <input type="text" value={idNumber} onChange={e => setIdNumber(e.target.value)}
                           className="w-full pl-12 pr-4 h-[60px] bg-[#F8F9FF] border-2 border-transparent focus:border-[#BA1A1A] rounded-lg text-base text-[#0B1C30] outline-none transition-colors"
                           placeholder="AW-2023-001" required />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-[#0B1C30] tracking-wider">Kata Sandi</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#BA1A1A]">lock</span>
                    <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                           className="w-full pl-12 pr-12 h-[60px] bg-[#F8F9FF] border-2 border-transparent focus:border-[#BA1A1A] rounded-lg text-base text-[#0B1C30] outline-none transition-colors"
                           placeholder="********" required />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#75777D] hover:text-[#0B1C30]">
                      <span className="material-symbols-outlined text-lg">{showPass ? 'visibility_off' : 'visibility'}</span>
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading}
                        className="w-full h-[56px] mt-4 bg-[#091426] text-white font-bold text-base rounded-lg shadow-md hover:bg-black flex justify-center items-center gap-2 transition-all disabled:opacity-70">
                  {loading ? 'Memverifikasi...' : <>Masuk Sistem <span className="material-symbols-outlined">arrow_forward</span></>}
                </button>
              </form>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}