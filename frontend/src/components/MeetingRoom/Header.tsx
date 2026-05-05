import { useEffect, useState } from 'react'
import { useMeetingStore } from '../../store.ts'

export default function Header({ title }: { title: string }) {
  const { startedAt, isActive } = useMeetingStore()
  const [elapsed, setElapsed] = useState('00:00')

  useEffect(() => {
    if (!startedAt) return
    const id = setInterval(() => {
      const s = Math.floor((Date.now() - startedAt) / 1000)
      const m = Math.floor(s / 60).toString().padStart(2, '0')
      const sec = (s % 60).toString().padStart(2, '0')
      setElapsed(`${m}:${sec}`)
    }, 1000)
    return () => clearInterval(id)
  }, [startedAt])

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-[#0f0f13]">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🐾</span>
        <h1 className="text-lg font-semibold text-slate-100">{title}</h1>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-slate-400 font-mono text-lg">{elapsed}</span>
        {isActive && (
          <span className="flex items-center gap-1.5 text-sm text-red-400">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            EN COURS
          </span>
        )}
      </div>
    </header>
  )
}
