import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'

const CONFIG = {
  fit:      { icon: CheckCircle2, color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-300', label: 'FIT ✅' },
  at_risk:  { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-300', label: 'AT RISK ⚠️' },
  not_fit:  { icon: XCircle,      color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-300',   label: 'NOT FIT ❌' }
}

export default function ResultCard({ result }) {
  const cfg = CONFIG[result.status] || CONFIG.at_risk
  const Icon = cfg.icon

  return (
    <div className={`border-2 ${cfg.border} ${cfg.bg} rounded-2xl p-6 space-y-4`}>
      <div className="flex items-center gap-3">
        <Icon size={36} className={cfg.color} />
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Status Hari Ini</p>
          <p className={`text-2xl font-bold ${cfg.color}`}>{cfg.label}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-3 text-center border border-gray-100">
          <p className="text-xs text-gray-400">Risk Score</p>
          <p className="text-xl font-bold text-gray-800">{(result.risk_score * 100).toFixed(0)}%</p>
        </div>
        <div className="bg-white rounded-xl p-3 text-center border border-gray-100">
          <p className="text-xs text-gray-400">Fatigue Score</p>
          <p className="text-xl font-bold text-gray-800">{(result.fatigue_score * 100).toFixed(0)}%</p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 border border-gray-100">
        <p className="text-sm font-semibold text-gray-700 mb-1">Pesan</p>
        <p className="text-sm text-gray-600">{result.message}</p>
      </div>

      <div className="bg-white rounded-xl p-4 border border-gray-100">
        <p className="text-sm font-semibold text-gray-700 mb-1">Rekomendasi</p>
        <p className="text-sm text-gray-600">{result.recommendation}</p>
      </div>
    </div>
  )
}