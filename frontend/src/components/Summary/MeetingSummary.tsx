import { useEffect, useState } from 'react'

interface Meeting {
  id: string
  title: string
  startedAt: string
  endedAt: string | null
  durationMin: number | null
  summary: string | null
  speakers: Array<{ name: string; talkPercent: number }>
  actions: Array<{ id: string; text: string; assignee: string; deadline: string | null; status: string }>
  blopState: { happiness: number; mood: string; reason: string | null } | null
}

const STATUS_ICON: Record<string, string> = { pending: '⏳', done: '✅', overdue: '🔴' }
const MOOD_COLOR: Record<string, string> = {
  euphoric: 'text-purple-400', happy: 'text-blue-400',
  stressed: 'text-orange-400', sad: 'text-red-400', distressed: 'text-red-600'
}

export default function MeetingSummary({ meetingId }: { meetingId: string }) {
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch(`/api/meetings/${meetingId}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setMeeting)
      .catch(() => setError(true))
  }, [meetingId])

  if (error) return (
    <div className="flex items-center justify-center min-h-screen text-slate-500">
      Réunion introuvable.
    </div>
  )

  if (!meeting) return (
    <div className="flex items-center justify-center min-h-screen text-slate-500">
      Chargement...
    </div>
  )

  const date = new Date(meeting.startedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <div className="min-h-screen bg-[#0f0f13] text-slate-200 p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
          <span>🐾 MeetPet</span>
          <span>·</span>
          <span>{date}</span>
          {meeting.durationMin && <><span>·</span><span>{meeting.durationMin} min</span></>}
        </div>
        <h1 className="text-3xl font-bold text-slate-100">{meeting.title}</h1>
      </div>

      {/* Blop state */}
      {meeting.blopState && (
        <div className="bg-slate-900 rounded-xl p-4 mb-6 flex items-center gap-4">
          <span className="text-4xl">🐾</span>
          <div>
            <p className={`font-semibold capitalize ${MOOD_COLOR[meeting.blopState.mood] ?? 'text-slate-300'}`}>
              Blop était {meeting.blopState.mood} ({meeting.blopState.happiness}/100)
            </p>
            {meeting.blopState.reason && <p className="text-slate-500 text-sm">{meeting.blopState.reason}</p>}
          </div>
        </div>
      )}

      {/* Participants */}
      {meeting.speakers.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Participants</h2>
          <div className="flex flex-col gap-2">
            {meeting.speakers.sort((a, b) => b.talkPercent - a.talkPercent).map(s => (
              <div key={s.name} className="flex items-center gap-3">
                <span className="text-slate-300 w-32 truncate">{s.name}</span>
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${s.talkPercent > 50 ? 'bg-orange-500' : 'bg-purple-500'}`}
                    style={{ width: `${s.talkPercent}%` }}
                  />
                </div>
                <span className="text-slate-500 text-sm w-10 text-right">{Math.round(s.talkPercent)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mb-6">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Actions</h2>
        {meeting.actions.length === 0 ? (
          <p className="text-slate-600">Aucune action détectée.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {meeting.actions.map(a => (
              <div key={a.id} className="bg-slate-900 rounded-lg p-3 flex items-start gap-3">
                <span>{STATUS_ICON[a.status] ?? '⏳'}</span>
                <div className="flex-1">
                  <p className="text-slate-200">{a.text}</p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {a.assignee}{a.deadline ? ` · ${new Date(a.deadline).toLocaleDateString('fr-FR')}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compte-rendu Markdown */}
      {meeting.summary && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Compte-rendu complet</h2>
          <pre className="bg-slate-900 rounded-xl p-4 text-slate-300 text-sm whitespace-pre-wrap font-sans leading-relaxed">
            {meeting.summary}
          </pre>
        </div>
      )}

      <a href="/" className="text-purple-400 text-sm hover:underline">← Retour à l'accueil</a>
    </div>
  )
}
