import { useState, useRef, useCallback, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import SideNav from '../components/Layout/SideNav'
import TopBar from '../components/Layout/TopBar'
import api from '../api/axios'

const CAPTURE_INTERVAL_MS = 500
const SCREENING_DURATION = 15

export default function MLSandbox() {
  const { user } = useAuth()
  const [phase, setPhase] = useState('idle') // idle, streaming, analyzing, result
  const [logs, setLogs] = useState([])
  const [result, setResult] = useState(null)
  const [countdown, setCountdown] = useState(SCREENING_DURATION)
  const [engineConfig, setEngineConfig] = useState({
    use_cnn: true,
    use_mediapipe: true
  })
  const [selfReport, setSelfReport] = useState({
    sleep_hours: 8,
    energy_level: 5,
    physical_complaints: ''
  })
  const [realtimeMetrics, setRealtimeMetrics] = useState({
    ear: 0,
    mar: 0,
    face_detected: false,
    landmarks: null
  })
  const [error, setError] = useState('')
  
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const intervalRef = useRef(null)
  const timerRef = useRef(null)
  const framesRef = useRef([])
  const phaseRef = useRef('idle')

  const addLog = (msg) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 19)])
  }

  const updatePhase = (newPhase) => {
    setPhase(newPhase)
    phaseRef.current = newPhase
  }

  const captureFrame = useCallback(async () => {
    const video = videoRef.current
    if (!video || video.readyState < 2) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)
    const base64 = canvas.toDataURL('image/jpeg', 0.6)
    
    // Only accumulate frames during scanning phase
    if (phaseRef.current === 'scanning') {
      framesRef.current.push(base64)
    }

    // Real-time analysis for UI feedback
    try {
      const res = await api.post('/screening/realtime', {
        frame: base64,
        config: engineConfig
      })
      setRealtimeMetrics(res.data)
    } catch (err) {
      // Silent error for realtime
    }
  }, [engineConfig])

  const startTest = async () => {
    setError('')
    updatePhase('streaming')
    setResult(null)
    setCountdown(SCREENING_DURATION)
    setRealtimeMetrics({ ear: 0, mar: 0, face_detected: false, landmarks: null })
    framesRef.current = []
    
    addLog('Memulai kamera...')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480, facingMode: 'user' } 
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await new Promise((resolve) => {
          videoRef.current.onloadedmetadata = resolve
          setTimeout(resolve, 3000)
        })
        await videoRef.current.play()
      }
      addLog('Kamera aktif.')
    } catch (err) {
      const msg = 'Error kamera: ' + err.message
      addLog(msg)
      setError(msg)
    }
  }

  // Effect to handle real-time loop reactively
  useEffect(() => {
    if (phase !== 'idle' && phase !== 'analyzing') {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = setInterval(captureFrame, CAPTURE_INTERVAL_MS)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [phase, captureFrame])

  const runSequence = async () => {
    if (!videoRef.current) return
    
    updatePhase('scanning')
    framesRef.current = [] // Reset frames for the new batch
    addLog(`Memulai perekaman ${SCREENING_DURATION} detik...`)
    
    // Countdown timer
    let remaining = SCREENING_DURATION
    timerRef.current = setInterval(async () => {
      remaining -= 1
      setCountdown(remaining)
      
      if (remaining <= 0) {
        clearInterval(timerRef.current)
        // NOTE: We don't clear intervalRef anymore, it keeps running for real-time feedback
        
        addLog(`Perekaman selesai. Menganalisis ${framesRef.current.length} frame...`)
        updatePhase('analyzing')
        
        try {
          const startTime = performance.now()
          const res = await api.post('/screening/analyze', { 
            employee_id: user?.employee_id,
            frames: framesRef.current,
            self_report: selfReport,
            config: engineConfig
          })
          const duration = (performance.now() - startTime).toFixed(0)
          
          setResult(res.data)
          addLog(`Analisis selesai dalam ${duration}ms`)
          updatePhase('result')
        } catch (err) {
          const msg = err.response?.data?.detail || err.message
          addLog('Error: ' + msg)
          setError(msg)
          updatePhase('streaming')
        }
      }
    }, 1000)
  }

  const stopTest = () => {
    clearInterval(timerRef.current)
    clearInterval(intervalRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    updatePhase('idle')
    framesRef.current = []
    addLog('Pengujian dihentikan.')
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || video.readyState < 2) return;

    const ctx = canvas.getContext('2d');
    
    if (realtimeMetrics.landmarks && video.clientWidth > 0) {
      canvas.width = video.clientWidth;
      canvas.height = video.clientHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Calculate mapping for object-cover (SAME AS SCREENING.JSX)
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const cw = canvas.width;
      const ch = canvas.height;
      const vRatio = vw / vh;
      const cRatio = cw / ch;

      let renderW, renderH, offsetX, offsetY;
      if (vRatio > cRatio) {
        renderH = ch;
        renderW = ch * vRatio;
        offsetX = (cw - renderW) / 2;
        offsetY = 0;
      } else {
        renderW = cw;
        renderH = cw / vRatio;
        offsetX = 0;
        offsetY = (ch - renderH) / 2;
      }

      ctx.fillStyle = '#39b8fd'; // Matched with Screening.jsx
      realtimeMetrics.landmarks.forEach(lm => {
        const x = lm.x * renderW + offsetX;
        const y = lm.y * renderH + offsetY;
        ctx.beginPath();
        ctx.arc(x, y, 1.2, 0, 2 * Math.PI);
        ctx.fill();
      });
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [realtimeMetrics.landmarks, realtimeMetrics.ear]);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current)
      clearInterval(intervalRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  return (
    <div className="bg-background min-h-screen text-on-background">
      <TopBar title="AWARE Testing Lab" tabs={[{ label: 'ML Sandbox', active: true }]} />
      <div className="flex">
        <SideNav userName={user?.name} subLabel="Research & Development" />
        
        <main className="lg:ml-64 pt-[64px] min-h-screen px-margin-mobile md:px-margin-desktop pb-xl w-full">
          <div className="max-w-7xl mx-auto space-y-6 mt-md">
            <header className="flex justify-between items-end">
              <div>
                <h1 className="text-3xl font-bold text-primary">ML Engine Sandbox</h1>
                <p className="text-on-surface-variant">Uji coba logic Hybrid (CNN + MediaPipe) dengan batch frame otomatis (15 detik).</p>
              </div>
              <div className="bg-surface-container px-4 py-2 rounded-lg border border-outline-variant flex items-center gap-3">
                <span className="text-[10px] font-bold uppercase text-on-surface-variant">Session Status:</span>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${phase === 'scanning' ? 'bg-error' : phase === 'analyzing' ? 'bg-secondary' : 'bg-outline'}`} />
                  <span className="text-xs font-black uppercase">{phase}</span>
                </div>
              </div>
            </header>

            <div className="grid grid-cols-12 gap-6">
              
              {/* Left Column: Config & Realtime */}
              <div className="col-span-12 lg:col-span-3 space-y-4 order-2 lg:order-1">
                <div className="bg-surface-container p-6 rounded-2xl border border-outline-variant shadow-sm">
                  <h3 className="text-[10px] font-bold text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">settings</span>
                    Config Simulation
                  </h3>
                  
                  <div className="space-y-6">
                    {/* ML Engines */}
                    <div className="space-y-3">
                      <p className="text-[10px] font-bold text-on-surface-variant uppercase">ML Engines</p>
                      <div className="space-y-2">
                        <label className="flex items-center justify-between cursor-pointer bg-surface p-2 rounded-lg border border-outline/20">
                          <span className="text-xs font-medium">CNN (Fatigue)</span>
                          <input 
                            type="checkbox" 
                            checked={engineConfig.use_cnn}
                            onChange={(e) => setEngineConfig(prev => ({...prev, use_cnn: e.target.checked}))}
                            className="w-4 h-4 accent-primary" 
                          />
                        </label>
                        <label className="flex items-center justify-between cursor-pointer bg-surface p-2 rounded-lg border border-outline/20">
                          <span className="text-xs font-medium">MediaPipe</span>
                          <input 
                            type="checkbox" 
                            checked={engineConfig.use_mediapipe}
                            onChange={(e) => setEngineConfig(prev => ({...prev, use_mediapipe: e.target.checked}))}
                            className="w-4 h-4 accent-secondary" 
                          />
                        </label>
                      </div>
                    </div>

                    {/* Self Report Simulation */}
                    <div className="space-y-3">
                      <p className="text-[10px] font-bold text-on-surface-variant uppercase">Reports</p>
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-bold block mb-1">Sleep Hours</label>
                          <select 
                            value={selfReport.sleep_hours}
                            onChange={(e) => setSelfReport(prev => ({...prev, sleep_hours: Number(e.target.value)}))}
                            className="w-full bg-surface border border-outline/30 rounded-md p-2 text-xs"
                          >
                            {[4, 5, 6, 7, 8, 9].map(h => (
                              <option key={h} value={h}>{h} Hours</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold block mb-1">Energy Level</label>
                          <select 
                            value={selfReport.energy_level}
                            onChange={(e) => setSelfReport(prev => ({...prev, energy_level: Number(e.target.value)}))}
                            className="w-full bg-surface border border-outline/30 rounded-md p-2 text-xs"
                          >
                            {[1, 2, 3, 4, 5].map(l => (
                              <option key={l} value={l}>Level {l}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Real-time Metrics Card */}
                <div className="bg-surface-container p-6 rounded-2xl border border-outline-variant shadow-sm space-y-4">
                   <h3 className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">monitoring</span>
                    Live Metrics
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center text-[10px] font-bold">
                        <span className="text-on-surface-variant">EAR</span>
                        <span className={realtimeMetrics.ear < 0.22 ? 'text-error' : 'text-primary'}>{realtimeMetrics.ear.toFixed(2)}</span>
                      </div>
                      <div className="w-full h-1.5 bg-outline-variant rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-300 ${realtimeMetrics.ear < 0.22 ? 'bg-error' : 'bg-primary'}`} style={{ width: `${Math.min(realtimeMetrics.ear * 200, 100)}%` }} />
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center text-[10px] font-bold">
                        <span className="text-on-surface-variant">MAR</span>
                        <span className={realtimeMetrics.mar > 0.35 ? 'text-error' : 'text-secondary'}>{realtimeMetrics.mar.toFixed(2)}</span>
                      </div>
                      <div className="w-full h-1.5 bg-outline-variant rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-300 ${realtimeMetrics.mar > 0.35 ? 'bg-error' : 'bg-secondary'}`} style={{ width: `${Math.min(realtimeMetrics.mar * 150, 100)}%` }} />
                      </div>
                    </div>

                    <div className={`mt-2 p-2 rounded-lg text-center border ${realtimeMetrics.face_detected ? 'bg-green-50 border-green-200 text-green-700' : 'bg-error-container border-error text-error'} `}>
                       <p className="text-[10px] font-black uppercase tracking-widest leading-none">
                        {realtimeMetrics.face_detected ? 'FACE READY' : 'FACE LOST'}
                       </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Center Column: Camera Case (4/5 Aspect) */}
              <div className="col-span-12 lg:col-span-5 space-y-4 order-1 lg:order-2">
                <div 
                  className="relative w-full bg-[#0a1628] rounded-3xl overflow-hidden shadow-2xl border-4 border-primary/20"
                  style={{ aspectRatio: '4/5' }}
                >
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                  <canvas 
                    ref={canvasRef} 
                    className="absolute inset-0 w-full h-full pointer-events-none scale-x-[-1] z-10"
                  />
                  
                  {/* Face Frame Overlay (Same as Screening.jsx) */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                    <div
                      className="border-2 rounded-[40px] transition-all duration-500"
                      style={{
                        borderColor: realtimeMetrics.face_detected ? '#00E676' : '#39b8fd',
                        boxShadow: '0 0 0 2000px rgba(9,20,38,0.75)',
                        width: '55%',
                        height: '65%',
                      }}
                    />
                  </div>

                  {phase === 'scanning' && (
                    <div className="absolute top-8 left-1/2 -translate-x-1/2 z-30">
                       <div className="bg-background/90 backdrop-blur-md px-6 py-3 rounded-full border border-secondary shadow-lg flex items-center gap-4">
                        <span className="text-display-lg text-secondary leading-none font-bold">{countdown}</span>
                        <div className="h-8 w-[2px] bg-outline-variant" />
                        <span className="text-[10px] text-on-background uppercase font-bold leading-tight">
                          Detik<br/>Tersisa
                        </span>
                      </div>
                    </div>
                  )}

                  {phase === 'analyzing' && (
                    <div className="absolute inset-0 bg-primary/80 flex flex-col items-center justify-center z-40 backdrop-blur-sm">
                      <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mb-4" />
                      <p className="text-white font-black text-xl tracking-widest animate-pulse">ANALYZING HYBRID AI...</p>
                    </div>
                  )}
                  
                  {/* Controls Overlay */}
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 w-full px-8 flex gap-3">
                    {phase === 'idle' ? (
                      <button onClick={startTest} className="w-full bg-primary text-on-primary py-4 rounded-2xl font-black text-sm shadow-xl hover:scale-[1.02] transition-all">
                        ACTIVATE SENSORS
                      </button>
                    ) : (
                      <>
                        <button 
                          onClick={runSequence} 
                          disabled={phase === 'analyzing' || phase === 'scanning'}
                          className="flex-[3] bg-secondary text-on-secondary py-4 rounded-2xl font-black text-sm shadow-xl hover:scale-[1.02] disabled:opacity-50 disabled:scale-100 transition-all uppercase"
                        >
                          {phase === 'scanning' ? `PROCESSED ${framesRef.current.length} FRAMES` : 'Start 15s Batch'}
                        </button>
                        <button onClick={stopTest} className="flex-1 bg-surface/20 backdrop-blur-md text-white border-2 border-white/30 py-4 rounded-2xl font-black text-sm">
                           OFF
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="bg-error-container text-error p-4 rounded-xl text-xs font-bold border border-error/20">
                    {error}
                  </div>
                )}
              </div>

              {/* Right Column: Diagnostics & Result */}
              <div className="col-span-12 lg:col-span-4 space-y-4 order-3 lg:order-3">
                <div className="bg-surface-container-high p-6 rounded-2xl border border-outline-variant shadow-sm h-full flex flex-col">
                  <h2 className="text-[10px] text-primary uppercase font-bold tracking-widest mb-4">Diagnostics Console</h2>
                  
                  <div className="flex-1 space-y-4 overflow-y-auto pr-2">
                    {result ? (
                      <div className="space-y-4">
                        {/* Status Alert */}
                        <div className={`p-4 rounded-xl border-2 flex items-center gap-4 ${
                          result.status === 'not_fit' ? 'bg-error-container text-error border-error' : 
                          result.status === 'at_risk' ? 'bg-warning-container text-warning border-warning' : 
                          'bg-green-50 text-green-700 border-green-200'
                        }`}>
                          <span className="material-symbols-outlined text-3xl">
                            {result.status === 'not_fit' ? 'cancel' : result.status === 'at_risk' ? 'warning' : 'check_circle'}
                          </span>
                          <div>
                            <p className="text-[10px] uppercase font-bold opacity-60">Engine Verdict</p>
                            <p className="text-xl font-black uppercase tracking-tight">
                              {result.status.replace('_', ' ')}
                            </p>
                          </div>
                        </div>

                        {/* Result Matrix */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-surface p-3 rounded-xl border border-outline/10 text-center">
                            <p className="text-[8px] text-on-surface-variant uppercase font-black mb-1">Risk</p>
                            <p className="text-2xl font-black text-primary">{((result.risk_score ?? 0) * 100).toFixed(0)}%</p>
                          </div>
                          <div className="bg-surface p-3 rounded-xl border border-outline/10 text-center">
                            <p className="text-[8px] text-on-surface-variant uppercase font-black mb-1">Fatigue</p>
                            <p className="text-2xl font-black text-secondary">{((result.fatigue_score ?? 0) * 100).toFixed(0)}%</p>
                          </div>
                        </div>

                        {/* Logs inline with results */}
                        <div className="bg-black p-4 rounded-xl h-48 overflow-y-auto font-mono text-[9px] text-green-400 border border-green-900/30">
                          <p className="text-gray-500 mb-2 border-b border-gray-800 pb-1">-- REAL-TIME EXECUTION LOG --</p>
                          {logs.map((log, i) => <p key={i} className="mb-0.5">{log}</p>)}
                        </div>

                        {/* Meta */}
                        <div className="bg-surface/50 p-4 rounded-xl border border-outline/20">
                          <div className="flex justify-between text-[10px] font-bold">
                            <span className="text-on-surface-variant uppercase">Frames Analysed</span>
                            <span>{result.face_detected_count} / {result.total_frames}</span>
                          </div>
                          <div className="flex justify-between text-[10px] font-bold mt-1">
                            <span className="text-on-surface-variant uppercase">Yawns Counted</span>
                            <span className={result.yawn_count > 0 ? 'text-error' : ''}>{result.yawn_count}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4 opacity-30">
                        <span className="material-symbols-outlined text-6xl">biotech</span>
                        <p className="text-xs font-bold uppercase tracking-widest">Awaiting Batch Data...</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
