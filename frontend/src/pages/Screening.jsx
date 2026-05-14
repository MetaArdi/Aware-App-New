import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth }      from '../context/AuthContext'
import SideNav          from '../components/Layout/SideNav'
import TopBar           from '../components/Layout/TopBar'
import ResultPage       from '../components/Screening/ResultPage'
import SelfReportForm   from '../components/Screening/SelfReportForm'
import api              from '../api/axios'

const CAPTURE_INTERVAL_MS = 3000
const SCREENING_DURATION  = 30
const DEFAULT_SELF_REPORT = { sleep_hours: 7, energy_level: 3, physical_complaints: '' }

export default function Screening() {
  const { user }        = useAuth()
  const videoRef        = useRef(null)
  const streamRef       = useRef(null)
  const intervalRef     = useRef(null)
  const timerRef        = useRef(null)
  const framesRef       = useRef([])

  const [phase, setPhase]           = useState('prepare')
  const [countdown, setCountdown]   = useState(SCREENING_DURATION)
  const [frames, setFrames]         = useState([])
  const [selfReport, setSelfReport] = useState(DEFAULT_SELF_REPORT)
  const [error, setError]           = useState('')
  const [result, setResult]         = useState(null)

  useEffect(() => { framesRef.current = frames }, [frames])

  const captureFrame = useCallback(() => {
    const video = videoRef.current
    if (!video || video.readyState < 2) return
    const canvas  = document.createElement('canvas')
    canvas.width  = video.videoWidth  || 640
    canvas.height = video.videoHeight || 480
    canvas.getContext('2d').drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
    setFrames(prev => {
      const next = [...prev, dataUrl]
      framesRef.current = next
      return next
    })
  }, [])

  const stopCamera = useCallback(() => {
    clearInterval(intervalRef.current)
    clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const submitScreening = useCallback(async (capturedFrames, report) => {
    setPhase('analyzing')
    try {
      const res = await api.post('/screening/analyze', {
        employee_id: user.employee_id,
        frames:      capturedFrames,
        self_report: report
      })
      setResult(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Terjadi kesalahan saat analisis.')
      setPhase('prepare')
    }
  }, [user])

  const startCamera = async () => {
    setError('')
    setFrames([])
    framesRef.current = []
    setCountdown(SCREENING_DURATION)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      })
      streamRef.current = stream
      videoRef.current.srcObject = stream
      await new Promise((resolve) => {
        videoRef.current.onloadedmetadata = resolve
        setTimeout(resolve, 3000)
      })
      await videoRef.current.play()
      setPhase('scanning')
      intervalRef.current = setInterval(captureFrame, CAPTURE_INTERVAL_MS)
      let remaining = SCREENING_DURATION
      timerRef.current = setInterval(() => {
        remaining -= 1
        setCountdown(remaining)
        if (remaining <= 0) {
          clearInterval(timerRef.current)
          clearInterval(intervalRef.current)
          stopCamera()
          submitScreening(framesRef.current, selfReport)
        }
      }, 1000)
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Izin kamera ditolak. Buka pengaturan browser dan izinkan akses kamera.')
      } else if (err.name === 'NotFoundError') {
        setError('Kamera tidak ditemukan di perangkat ini.')
      } else {
        setError('Kamera tidak dapat diakses: ' + err.message)
      }
    }
  }

  const cancelScreening = () => {
    stopCamera()
    setFrames([])
    framesRef.current = []
    setCountdown(SCREENING_DURATION)
    setPhase('prepare')
  }

  useEffect(() => () => stopCamera(), [stopCamera])

  if (result) return <ResultPage result={result} onRestart={() => { setResult(null); setPhase('prepare') }} />

  return (
    <div className="bg-background text-on-background font-body-md">
      <TopBar title="AWARE" tabs={[
        { label: 'Assessment', active: true },
        { label: 'Dashboard',  active: false },
        { label: 'Health Logs', active: false },
      ]} />

      <div className="flex">
        <SideNav userName={user?.name} subLabel="Industrial Safety" />

        <main className="lg:ml-64 pt-[64px] min-h-screen px-margin-mobile md:px-margin-desktop pb-xl w-full">
          <div className="max-w-6xl mx-auto grid grid-cols-12 gap-lg mt-md">

            {/* Left */}
            <div className="col-span-12 lg:col-span-3 order-2 lg:order-1 flex flex-col gap-lg">

              {/* Self Report Form — tampil saat phase selfReport */}
              {phase === 'selfReport' && (
                <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm">
                  <h3 className="text-label-md text-secondary uppercase tracking-widest mb-sm">Laporan Kondisi</h3>
                  <SelfReportForm data={selfReport} onChange={setSelfReport} />
                  <div className="flex gap-md mt-lg">
                    <button
                      onClick={() => setPhase('prepare')}
                      className="flex-1 py-sm border-2 border-outline-variant text-on-surface-variant
                                 rounded-lg font-bold hover:bg-surface-container-high transition-all text-label-md"
                    >
                      Kembali
                    </button>
                    <button
                      onClick={startCamera}
                      className="flex-1 py-sm bg-secondary text-on-secondary rounded-lg font-bold
                                 hover:opacity-90 transition-all flex items-center justify-center gap-xs text-label-md"
                    >
                      <span className="material-symbols-outlined text-sm">videocam</span>
                      Mulai
                    </button>
                  </div>
                </div>
              )}

              {/* Instruksi — tampil saat bukan selfReport */}
              {phase !== 'selfReport' && (
                <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm">
                  <h3 className="text-label-md text-secondary uppercase tracking-widest mb-sm">Instruksi</h3>
                  <p className="text-body-md text-on-background leading-relaxed">
                    Posisikan wajah Anda di dalam kotak biru. Tetap fokus dan ikuti instruksi di layar selama proses pemindaian.
                  </p>
                </div>
              )}

              {phase !== 'selfReport' && (
                <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm">
                  <h3 className="text-label-md text-secondary uppercase tracking-widest mb-md">Metrik Real-time</h3>
                  <div className="space-y-lg">
                    <div className="flex flex-col gap-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-body-sm text-on-surface-variant flex items-center gap-xs">
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>visibility</span>
                          EAR (Eye Aspect Ratio)
                        </span>
                        <span className="text-label-md font-bold text-secondary">0.32</span>
                      </div>
                      <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                        <div className="bg-secondary h-full" style={{ width: '72%' }} />
                      </div>
                    </div>
                    <div className="flex flex-col gap-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-body-sm text-on-surface-variant flex items-center gap-xs">
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>face</span>
                          Yawn Detection
                        </span>
                        <span className="text-label-md font-bold text-error">TIDAK TERDETEKSI</span>
                      </div>
                      <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                        <div className="bg-error h-full" style={{ width: '15%' }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {phase === 'scanning' && (
                <div className="bg-surface-container-lowest border border-outline-variant p-md rounded-xl text-center">
                  <p className="text-label-md text-on-surface-variant mb-xs">Frame Tertangkap</p>
                  <p className="text-headline-md font-bold text-secondary">{frames.length}</p>
                </div>
              )}
            </div>

            {/* Center: Kamera — SELALU di DOM */}
            <div className="col-span-12 lg:col-span-6 order-1 lg:order-2">
              <div
                className="relative w-full bg-primary-container rounded-3xl overflow-hidden shadow-lg border border-primary"
                style={{ aspectRatio: '4/5' }}
              >
                {/* video SELALU rendered agar videoRef tidak null */}
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  autoPlay
                  className="w-full h-full object-cover"
                  style={{
                    transform: 'scaleX(-1)',
                    display: phase === 'scanning' ? 'block' : 'none'
                  }}
                />

                {/* Placeholder gelap saat kamera belum aktif */}
                {phase !== 'scanning' && (
                  <div className="absolute inset-0 bg-[#0a1628] flex items-center justify-center">
                    <span className="material-symbols-outlined text-outline" style={{ fontSize: '64px' }}>
                      videocam_off
                    </span>
                  </div>
                )}

                {/* Face frame overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div
                    className="border-2 rounded-[40px]"
                    style={{
                      borderColor: '#39b8fd',
                      boxShadow: '0 0 0 2000px rgba(9,20,38,0.75)',
                      width: '50%',
                      height: '60%',
                    }}
                  />
                </div>

                {/* Countdown */}
                <div className="absolute top-md left-1/2 -translate-x-1/2 z-20">
                  <div className="bg-background/90 backdrop-blur-md px-xl py-sm rounded-full
                                   border border-secondary shadow-lg flex items-center gap-md">
                    <span className="text-display-lg text-secondary leading-none font-bold">{countdown}</span>
                    <div className="h-8 w-[2px] bg-outline-variant" />
                    <span className="text-label-md text-on-background uppercase tracking-wider">
                      Detik<br />Tersisa
                    </span>
                  </div>
                </div>

                {/* CTA */}
                <div className="absolute bottom-xl left-1/2 -translate-x-1/2 z-20 w-full px-lg text-center">
                  {phase === 'scanning' ? (
                    <div className="bg-primary/80 backdrop-blur-sm text-on-primary py-md px-lg
                                     rounded-xl inline-flex items-center gap-sm border border-on-primary/20">
                      <span className="material-symbols-outlined text-secondary-container">check_circle</span>
                      <span className="font-semibold text-label-md">POSISI WAJAH OPTIMAL</span>
                    </div>
                  ) : phase === 'prepare' ? (
                    <button
                      onClick={() => setPhase('selfReport')}
                      className="bg-secondary text-on-secondary py-md px-xl rounded-xl
                                 font-bold text-label-md hover:opacity-90 transition-all"
                    >
                      Mulai Screening
                    </button>
                  ) : null}
                </div>

                {/* Analyzing overlay */}
                {phase === 'analyzing' && (
                  <div className="absolute inset-0 bg-primary/80 flex flex-col items-center justify-center z-30">
                    <div className="w-12 h-12 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin mb-md" />
                    <p className="text-on-primary text-body-sm">Menganalisis kondisi Anda...</p>
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-md bg-error-container text-error text-body-sm rounded-lg px-md py-sm">
                  {error}
                </div>
              )}
            </div>

            {/* Right */}
            <div className="col-span-12 lg:col-span-3 order-3 flex flex-col gap-lg">
              <div className="bg-surface-container-low border border-outline-variant p-lg rounded-xl flex flex-col items-center text-center">
                <span className="material-symbols-outlined text-secondary mb-sm" style={{ fontSize: '48px' }}>monitoring</span>
                <h4 className="text-headline-md font-bold text-primary">Fit-to-Work</h4>
                <p className="text-body-sm text-on-surface-variant">Analisis sedang berjalan...</p>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-lg">
                <div className="bg-surface-container-lowest border border-outline-variant p-md rounded-xl">
                  <span className="text-label-md text-on-surface-variant block mb-xs">Heart Rate</span>
                  <div className="flex items-baseline gap-xs">
                    <span className="text-headline-lg font-bold text-primary">72</span>
                    <span className="text-body-sm text-on-surface-variant">BPM</span>
                  </div>
                </div>
                <div className="bg-surface-container-lowest border border-outline-variant p-md rounded-xl">
                  <span className="text-label-md text-on-surface-variant block mb-xs">Focus Score</span>
                  <div className="flex items-baseline gap-xs">
                    <span className="text-headline-lg font-bold text-primary">94</span>
                    <span className="text-body-sm text-on-surface-variant">%</span>
                  </div>
                </div>
              </div>
              {phase === 'scanning' && (
                <button
                  onClick={cancelScreening}
                  className="mt-auto w-full py-lg bg-error text-on-error rounded-xl font-bold
                             flex items-center justify-center gap-md hover:opacity-90 transition-all"
                >
                  <span className="material-symbols-outlined">cancel</span>
                  BATALKAN SCREENING
                </button>
              )}
            </div>

          </div>
        </main>
      </div>
    </div>
  )
}