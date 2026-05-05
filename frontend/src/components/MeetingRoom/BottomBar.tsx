import { useMeetingStore } from '../../store.ts'

export default function BottomBar() {
  const { activeSpeaker } = useMeetingStore()

  return (
    <div className="border-t border-slate-800 px-6 py-3 flex items-center justify-between bg-[#0f0f13]">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        {activeSpeaker ? (
          <>
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span><span className="text-green-400 font-medium">{activeSpeaker}</span> parle...</span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-slate-600" />
            <span>Silence</span>
          </>
        )}
      </div>
      <p className="text-slate-600 text-xs">Lance <code className="bg-slate-800 px-1 rounded">/meetpet stop</code> dans Discord pour terminer</p>
    </div>
  )
}
