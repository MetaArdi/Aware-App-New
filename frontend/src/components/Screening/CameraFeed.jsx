import { useRef, useEffect, useState, useCallback } from 'react'
import { Camera, AlertCircle } from 'lucide-react'

const CAPTURE_INTERVAL_MS = 3000
const SCREENING_DURATION  = 30

export default function CameraFeed({ onComplete }) {
  const videoRef    = useRef(null)
  const streamRef   = useRef(null)
  const intervalRef = useRef(null)
  const timerRef    = useRef(null)

  const [error, setError]         = useState('')
  const [active, setActive]       = useState(false)
  const [countdown, setCountdown] = useState(SCREENING_DURATION)
  const [frames, setFrames]       = useState([])

  const captureFrame = useCallback(() => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas  = document.createElement('canvas')
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    setFrames(prev => [...prev, canvas.toDataURL('image/jpeg', 0.7)])
  }, [])

  const stopCamera = useCallback(() => {
    clearInterval(intervalRef.current)
    clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setActive(false)
  }, [])

  const startCamera = async () => {
    setError('')
    setFrames([])
    setCountdown(SCREENING_DURATION)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      })
      streamRef.current = stream

      if (!videoRef.current) {
        setError('Komponen kamera belum siap, coba lagi.')
        stream.getTracks().forEach(t => t.stop())
        return
      }

      videoRef.current.srcObject = stream

      await new Promise((resolve, reject) => {
        videoRef.current.onloadedmetadata = resolve
        videoRef.current.onerror = reject
        setTimeout(resolve, 3000)
      })

      await videoRef.current.play()
      setActive(true)

      intervalRef.current = setInterval(captureFrame, CAPTURE_INTERVAL_MS)

      let remaining = SCREENING_DURATION
      timerRef.current = setInterval(() => {
        remaining -= 1
        setCountdown(remaining)
        if (remaining <= 0) {
          stopCamera()
          setFrames(prev => { onComplete(prev); return prev })
        }
      }, 1000)

    } catch (err) {
      console.error('Camera error:', err)
      if (err.name === 'NotAllowedError') {
        setError('Izin kamera ditolak. Buka pengaturan browser dan izinkan akses kamera.')
      } else if (err.name === 'NotFoundError') {
        setError('Kamera tidak ditemukan di perangkat ini.')
      } else if (err.name === 'NotReadableError') {
        setError('Kamera sedang digunakan aplikasi lain. Tutup aplikasi lain dan coba lagi.')
      } else {
        setError('Kamera tidak dapat diakses. Pastikan izin kamera diberikan.')
      }
    }
  }

  useEffect(() => () => stopCamera(), [stopCamera])

  const progress        = ((SCREENING_DURATION - countdown) / SCREENING_DURATION) * 100
  const r               = 22
  const circumference   = 2 * Math.PI * r

  return (
    <div className="flex flex-col items-center gap-5">

      {/* Camera view */}
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden border border-[#1E3A5F] bg-[#0F1923]"
        style={{ aspectRatio: '4/3' }}
      >
        {/* Video SELALU ada di DOM supaya ref tidak null saat startCamera */}
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          className="w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)', display: active ? 'block' : 'none' }}
        />

        {/* Placeholder saat kamera belum aktif */}
        {!active && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-[#64748B] gap-3">
            <Camera size={48} className="opacity-30" />
            <p className="text-sm">Kamera belum aktif</p>
          </div>
        )}

        {/* Overlay saat aktif */}
        {active && (
          <>
            {/* Panduan oval */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-44 h-52 border-2 border-blue-400 border-dashed rounded-full opacity-80" />
            </div>

            {/* Countdown circle — pojok kanan atas */}
            <div className="absolute top-3 right-3">
              <svg width="52" height="52" className="-rotate-90">
                <circle
                  cx="26" cy="26" r={r}
                  fill="rgba(15,25,35,0.8)"
                  stroke="#1E3A5F"
                  strokeWidth="3"
                />
                <circle
                  cx="26" cy="26" r={r}
                  fill="transparent"
                  stroke="#2563EB"
                  strokeWidth="3"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - progress / 100)}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm"
                    style={{ transform: 'rotate(90deg)' }}>
                {countdown}
              </span>
            </div>

            {/* Progress bar bawah */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-[#0F1923] to-transparent py-3 px-4">
              <div className="w-full bg-[#1E3A5F] rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-1000"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 bg-red-900/30 border border-red-700 px-4 py-3 rounded-xl text-sm w-full">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Tombol mulai */}
      {!active && (
        <button onClick={startCamera} className="btn-primary px-10 flex items-center gap-2">
          <Camera size={16} />
          Mulai Screening
        </button>
      )}

      {active && (
        <p className="text-[#64748B] text-xs text-center">
          Lihat kamera dan pastikan wajah berada dalam panduan oval.<br />
          Jangan bergerak terlalu banyak selama proses berlangsung.
        </p>
      )}
    </div>
  )
}