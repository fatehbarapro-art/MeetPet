import type { MeetingSession } from '../types/index.js'
import { broadcast } from '../server.js'

const DOMINANCE_THRESHOLD_MS = process.env.NODE_ENV === 'development' ? 30_000 : 5 * 60 * 1000  // 30s en dev, 5min en prod
const SILENCE_THRESHOLD_MS   = 2 * 60 * 1000   // 2 minutes
const CHECK_INTERVAL_MS      = 15_000            // vérif toutes les 15s

export function startEventLoop(session: MeetingSession): ReturnType<typeof setInterval> {
  return setInterval(() => checkEvents(session), CHECK_INTERVAL_MS)
}

function checkEvents(session: MeetingSession) {
  const now = Date.now()

  // Dominance
  if (session.activeSpeaker && session.activeSpeakerStart) {
    const elapsed = now - session.activeSpeakerStart
    if (elapsed >= DOMINANCE_THRESHOLD_MS) {
      const minutes = Math.round(elapsed / 60000)
      broadcast({ type: 'dominance_alert', speaker: session.activeSpeaker, minutes })
    }
  }

  // Silence
  if (now - session.lastSpeechAt >= SILENCE_THRESHOLD_MS) {
    broadcast({ type: 'blop_event', event: 'silence', blopDelta: -5, message: 'Silence prolongé...' })
  }
}

export function onSpeakerStart(userId: string, displayName: string, session: MeetingSession) {
  const isNew = !session.knownSpeakers.has(userId)
  if (isNew) {
    session.knownSpeakers.add(userId)
    broadcast({ type: 'blop_event', event: 'new_speaker', speaker: displayName, blopDelta: 5, message: `${displayName} vient de prendre la parole !` })
  }

  session.activeSpeaker = displayName
  session.activeSpeakerStart = Date.now()
  session.lastSpeechAt = Date.now()
  broadcast({ type: 'speaker_change', current: displayName })
}

export function onSpeakerEnd(userId: string, seconds: number, session: MeetingSession) {
  session.speakerSeconds[userId] = (session.speakerSeconds[userId] ?? 0) + seconds
  session.activeSpeaker = null
  session.activeSpeakerStart = null
}
