import { useEffect, useRef } from 'react'
import { useMeetingStore } from '../../store.ts'

export default function Transcript() {
  const { transcript } = useMeetingStore()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-800">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Transcription en direct</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
        {transcript.length === 0 && (
          <p className="text-slate-600 text-sm text-center mt-8">En attente de la parole...</p>
        )}
        {transcript.map((seg, i) => (
          <div key={i} className={`rounded-lg px-3 py-2 text-sm ${seg.isBlop ? 'bg-purple-900/40 border border-purple-700/50' : 'bg-slate-900'}`}>
            <span className={`font-semibold text-xs ${seg.isBlop ? 'text-purple-400' : 'text-slate-400'}`}>
              {seg.speaker}
            </span>
            <p className="text-slate-200 mt-0.5 leading-relaxed">{seg.text}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
