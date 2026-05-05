import { useMeetingStore } from '../../store.ts'

export default function SpeakerBars() {
  const { speakerTime, activeSpeaker } = useMeetingStore()
  const entries = Object.entries(speakerTime)
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1

  if (entries.length === 0) {
    return (
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Temps de parole</h2>
        <p className="text-slate-600 text-sm">En attente...</p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Temps de parole</h2>
      <div className="flex flex-col gap-2">
        {entries
          .sort(([, a], [, b]) => b - a)
          .map(([name, time]) => {
            const pct = Math.round((time / total) * 100)
            const isActive = name === activeSpeaker
            return (
              <div key={name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className={`${isActive ? 'text-purple-400 font-medium' : 'text-slate-400'}`}>
                    {isActive && <span className="mr-1">🎙️</span>}{name}
                  </span>
                  <span className="text-slate-500">{pct}%</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${pct > 50 ? 'bg-orange-500' : 'bg-purple-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
