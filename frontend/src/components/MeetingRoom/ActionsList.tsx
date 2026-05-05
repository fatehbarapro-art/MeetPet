import { useMeetingStore } from '../../store.ts'

const STATUS_ICON: Record<string, string> = {
  pending: '⏳',
  done: '✅',
  overdue: '🔴',
}

export default function ActionsList() {
  const { actions } = useMeetingStore()

  return (
    <div className="flex-1 min-h-0">
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Actions détectées</h2>
      {actions.length === 0 ? (
        <p className="text-slate-600 text-sm">Aucune action pour le moment</p>
      ) : (
        <div className="flex flex-col gap-2 overflow-y-auto max-h-64">
          {actions.map((a) => (
            <div key={a.id} className="bg-slate-900 rounded-lg p-2.5 text-sm">
              <div className="flex items-start gap-1.5">
                <span>{STATUS_ICON[a.status]}</span>
                <div>
                  <p className="text-slate-200 leading-snug">{a.text}</p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {a.assignee}{a.deadline ? ` · ${new Date(a.deadline).toLocaleDateString('fr-FR')}` : ''}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
