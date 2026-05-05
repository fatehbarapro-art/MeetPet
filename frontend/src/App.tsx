import { useWebSocket } from './hooks/useWebSocket.ts'
import { useMeetingStore } from './store.ts'
import MeetingRoom from './components/MeetingRoom/MeetingRoom.tsx'
import MeetingSummary from './components/Summary/MeetingSummary.tsx'

function getRoute() {
  const path = window.location.pathname
  const match = path.match(/^\/summary\/(.+)$/)
  if (match) return { page: 'summary', id: match[1] }
  return { page: 'home', id: null }
}

export default function App() {
  useWebSocket()
  const { isActive } = useMeetingStore()
  const route = getRoute()

  if (route.page === 'summary') {
    return <MeetingSummary meetingId={route.id!} />
  }

  return (
    <div className="min-h-screen bg-[#0f0f13] text-slate-200">
      {isActive ? (
        <MeetingRoom />
      ) : (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <div className="text-6xl">🐾</div>
          <h1 className="text-3xl font-bold text-purple-400">MeetPet</h1>
          <p className="text-slate-400 text-lg">Lance <code className="bg-slate-800 px-2 py-1 rounded">/meetpet start</code> dans Discord pour commencer</p>
          <p className="text-slate-600 text-sm">En attente d'une réunion...</p>
        </div>
      )}
    </div>
  )
}
