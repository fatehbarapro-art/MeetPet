import type { BlopState } from '../../types/index.ts'

const METRICS = [
  { key: 'energy',   label: 'Énergie',   color: '#5B8DEF' },
  { key: 'balance',  label: 'Équilibre', color: '#7B2FBE' },
  { key: 'focus',    label: 'Focus',     color: '#FF8C00' },
  { key: 'happiness',label: 'Bonheur',   color: '#4CAF50' },
] as const

export default function BlopStats({ state }: { state: BlopState }) {
  return (
    <div className="w-56 flex flex-col gap-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-500 uppercase tracking-wider">Niveau {state.level}</span>
        <span className="text-xs text-slate-500 capitalize">{state.mood}</span>
      </div>
      {METRICS.map(({ key, label, color }) => (
        <div key={key}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">{label}</span>
            <span className="text-slate-500">{state[key]}</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${state[key]}%`, backgroundColor: color }}
            />
          </div>
        </div>
      ))}
      {state.reason && (
        <p className="text-slate-500 text-xs text-center mt-1 italic">"{state.reason}"</p>
      )}
    </div>
  )
}
