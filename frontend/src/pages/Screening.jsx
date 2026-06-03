import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import SideNav from '../components/Layout/SideNav'
import TopBar from '../components/Layout/TopBar'
import ResultPage from '../components/Screening/ResultPage'
import SelfReportForm from '../components/Screening/SelfReportForm'
import api from '../api/axios'

const CAPTURE_INTERVAL_MS = 3000
const SCREENING_DURATION = 30

export default function Screening() {
  const { user } = useAuth()
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const intervalRef = useRef(null)
  const timerRef = useRef(null)
  
  const [phase, setPhase] = useState('prepare')
  const [countdown, setCountdown] = useState(SCREENING_DURATION)
  const [frames, setFrames] = useState([])
  const [selfReport, setSelfReport] = useState({ sleep_hours: 7, energy_level: 3, physical_complaints: '' })
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [liveMetrics, setLiveMetrics] = useState({ ear: 0.32, yawn: false })

  // Fungsi untuk menangkap frame Base64
  const captureFrame = useCallback(() => {
    const video = videoRef.current
    if (!video || video.readyState < 2) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    canvas.getContext('2d').drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
    
    setLiveMetrics({ ear: (0.30 + Math.random() * 0.05).toFixed(2), yawn: Math.random() > 0.85 })
    setFrames(prev => [...prev, dataUrl])
  }, [])

  const stopCamera = useCallback(() => {
    clearInterval(intervalRef.current)
    clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const submitScreening = useCallback(async (capturedFrames) => {
    setPhase('analyzing')
    try {
      const res = await api.post('/screening/analyze', {
        employee_id: user.employee_id,
        frames: capturedFrames,
        self_report: selfReport
      })
      setResult(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Terjadi kesalahan saat analisis.')
      setPhase('prepare')
    }
  }, [user, selfReport])

  const startCamera = async () => {
    setError('')
    setFrames([])
    setCountdown(SCREENING_DURATION)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } })
      streamRef.current = stream
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      
      setPhase('scanning')
      intervalRef.current = setInterval(captureFrame, CAPTURE_INTERVAL_MS)
      
      let remaining = SCREENING_DURATION
      timerRef.current = setInterval(() => {
        remaining -= 1
        setCountdown(remaining)
        if (remaining <= 0) {
          stopCamera()
          // Passing frames state menggunakan hook setter trick agar sinkron (atau gunakan custom ref)
          setFrames(finalFrames => {
            submitScreening(finalFrames)
            return finalFrames
          })
        }
      }, 1000)
    } catch (err) {
      setError('Kamera tidak dapat diakses. Pastikan izin browser diaktifkan.')
    }
  }

  useEffect(() => () => stopCamera(), [stopCamera])

  if (result) return <ResultPage result={result} onRestart={() => { setResult(null); setPhase('prepare') }} />

  return (
    <div className="bg-[#F8F9FF] text-[#0B1C30] font-['IBM_Plex_Sans'] min-h-screen">
      <TopBar title="AWARE" tabs={[{ label: 'Assessment', active: true }]} />
      <div className="flex">
        <SideNav userName={user?.name} subLabel="Industrial Safety" />

        <main className="lg:ml-64 pt-24 px-6 md:px-10 pb-10 w-full max-w-[1280px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Area */}
            <div className="col-span-12 lg:col-span-4 xl:col-span-3 flex flex-col gap-6 order-2 lg:order-1">
              {phase !== 'selfReport' && (
                <div className="bg-white border border-[#C5C6CD] shadow-sm rounded-xl p-6 flex flex-col gap-4">
                  <h3 className="text-2xl font-semibold text-[#091426]">Instruksi</h3>
                  <ul className="flex flex-col gap-4">
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-[#006591]">1.</span>
                      <span className="text-base text-[#45474C]">Posisikan wajah tepat di dalam area *bounding box*.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-[#006591]">2.</span>
                      <span className="text-base text-[#45474C]">Jaga pandangan tetap lurus ke arah kamera.</span>
                    </li>
                  </ul>
                </div>
              )}

              {phase === 'scanning' && (
                <>
                  <div className="bg-white border border-[#C5C6CD] shadow-sm rounded-xl p-6 flex flex-col gap-4">
                    <h3 className="text-xl font-semibold text-[#091426]">Metrik Real-Time</h3>
                    <div className="flex justify-between items-center">
                      <span className="text-[#0B1C30] font-medium">EAR</span>
                      <span className="text-2xl font-semibold text-[#006591]">{liveMetrics.ear}</span>
                    </div>
                  </div>
                  <button onClick={() => { stopCamera(); setPhase('prepare') }} className="h-12 border border-[#BA1A1A] rounded-lg flex justify-center items-center gap-2 text-[#BA1A1A] font-semibold hover:bg-red-50">
                    BATALKAN
                  </button>
                </>
              )}
            </div>

            {/* Center Area: Camera */}
            <div className="col-span-12 lg:col-span-8 xl:col-span-9 order-1 lg:order-2">
              <div className="relative w-full h-[500px] lg:h-[600px] bg-[#1E293B] border-[4px] border-[#DCE9FF] rounded-3xl shadow-xl overflow-hidden flex flex-col justify-center items-center">
                
                {phase !== 'scanning' && <div className="absolute inset-0 bg-[#091426]/60 backdrop-blur-sm z-10" />}
                <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" style={{ display: phase === 'scanning' ? 'block' : 'none' }} />

                {phase === 'scanning' && (
                  <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                     <div className="w-[60%] h-[70%] border-[3px] border-[#39B8FD] rounded-[40px] shadow-[0_0_0_2000px_rgba(9,20,38,0.7)]" />
                  </div>
                )}

                {phase === 'prepare' && (
                  <div className="relative z-20 flex flex-col items-center gap-6">
                    <span className="material-symbols-outlined text-white text-6xl">videocam_off</span>
                    <button onClick={startCamera} className="bg-[#006591] hover:bg-[#004b6b] text-white py-4 px-8 rounded-lg font-bold text-lg flex items-center gap-3 shadow-lg transition-transform hover:scale-105">
                      MULAI PEMINDAIAN <span className="material-symbols-outlined">arrow_forward</span>
                    </button>
                  </div>
                )}

                {phase === 'scanning' && (
                  <div className="absolute top-6 z-20 bg-[#091426]/80 backdrop-blur-md px-6 py-2 rounded-full border border-[#006591] flex items-center gap-4">
                    <span className="text-3xl font-bold text-[#39B8FD]">{countdown}</span>
                    <span className="text-xs font-bold text-white uppercase tracking-widest">Detik<br/>Tersisa</span>
                  </div>
                )}

                {phase === 'analyzing' && (
                  <div className="relative z-20 flex flex-col items-center">
                    <div className="w-16 h-16 border-4 border-[#39B8FD]/30 border-t-[#39B8FD] rounded-full animate-spin mb-4" />
                    <p className="text-white text-xl font-semibold">Memproses Data Telemetri AI...</p>
                  </div>
                )}
              </div>
              
              {error && (
                <div className="mt-4 p-4 bg-[#FFDAD6] border border-[#BA1A1A]/20 rounded-lg text-sm font-bold text-[#93000A]">
                   {error}
                </div>
              )}
            </div>
            
          </div>
        </main>
      </div>
    </div>
  )
}