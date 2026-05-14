export default function SelfReportForm({ data, onChange }) {
  const complaints = ['Pusing', 'Mual', 'Nyeri', 'Sesak', 'Lemah']

  const toggleComplaint = (c) => {
    const current = data.physical_complaints
      ? data.physical_complaints.split(',').filter(Boolean)
      : []
    const updated = current.includes(c)
      ? current.filter(x => x !== c)
      : [...current, c]
    onChange({ ...data, physical_complaints: updated.join(',') })
  }

  const active = data.physical_complaints
    ? data.physical_complaints.split(',').filter(Boolean)
    : []

  return (
    <div className="space-y-lg">
      {/* Sleep Hours */}
      <div>
        <label className="block text-label-md text-on-surface mb-xs">
          Semalam tidur berapa jam?{' '}
          <span className="text-secondary font-bold">{data.sleep_hours} jam</span>
        </label>
        <input
          type="range" min="1" max="12" step="0.5"
          value={data.sleep_hours}
          onChange={e => onChange({ ...data, sleep_hours: parseFloat(e.target.value) })}
          className="w-full accent-[#006591]"
        />
        <div className="flex justify-between text-body-sm text-on-surface-variant mt-xs">
          <span>1 jam</span><span>12 jam</span>
        </div>
      </div>

      {/* Energy Level */}
      <div>
        <label className="block text-label-md text-on-surface mb-xs">
          Tingkat energi hari ini
        </label>
        <div className="flex gap-sm">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n} type="button"
              onClick={() => onChange({ ...data, energy_level: n })}
              className={`flex-1 py-sm rounded-lg font-bold border-2 transition text-body-sm
                ${data.energy_level === n
                  ? 'bg-secondary border-secondary text-on-secondary'
                  : 'border-outline-variant text-on-surface-variant hover:border-secondary'}`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-body-sm text-on-surface-variant mt-xs">
          <span>Sangat Lelah</span><span>Prima</span>
        </div>
      </div>

      {/* Physical Complaints */}
      <div>
        <label className="block text-label-md text-on-surface mb-xs">
          Ada keluhan fisik? (opsional)
        </label>
        <div className="flex flex-wrap gap-sm">
          {complaints.map(c => (
            <button
              key={c} type="button"
              onClick={() => toggleComplaint(c)}
              className={`px-md py-xs rounded-full text-body-sm border transition
                ${active.includes(c)
                  ? 'bg-error-container border-error text-error'
                  : 'border-outline-variant text-on-surface-variant hover:border-outline'}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}