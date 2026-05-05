import type { MeetingSession } from '../types/index.js'
import { broadcast } from '../server.js'

const DOMINANCE_THRESHOLD_MS = process.env.NODE_ENV === 'development' ? 30_000 : 5 * 60 * 1000  // 30s en dev, 5min en prod
const SILENCE_THRESHOLD_MS   = 2 * 60 * 1000   // 2 minutes
const CHECK_INTERVAL_MS      = 15_000            // vérif toutes les 15s

export type MeetingRuleEvent =
  | { type: 'dominance'; speaker: string; minutes: number }
  | { type: 'silence' }

type MeetingRuleHandler = (event: MeetingRuleEvent) => void | Promise<void>

export function startEventLoop(
  session: MeetingSession,
  onEvent?: MeetingRuleHandler
): ReturnType<typeof setInterval> {
  return setInterval(() => void checkEvents(session, onEvent), CHECK_INTERVAL_MS)
}

async function checkEvents(session: MeetingSession, onEvent?: MeetingRuleHandler) {
  const now = Date.now()

  // Dominance
  if (session.activeSpeaker && session.activeSpeakerStart) {
    const elapsed = now - session.activeSpeakerStart
    if (elapsed >= DOMINANCE_THRESHOLD_MS && !session.lastDominanceAlertAt) {
      const minutes = Math.round(elapsed / 60000)
      session.lastDominanceAlertAt = now
      broadcast({ type: 'dominance_alert', speaker: session.activeSpeaker, minutes })
      await onEvent?.({ type: 'dominance', speaker: session.activeSpeaker, minutes })
    }
  }

  // Silence
  if (now - session.lastSpeechAt >= SILENCE_THRESHOLD_MS && !session.lastSilenceAlertAt) {
    session.lastSilenceAlertAt = now
    broadcast({ type: 'blop_event', event: 'silence', blopDelta: -5, message: 'Silence prolongé...' })
    await onEvent?.({ type: 'silence' })
  }
}

export function onSpeakerStart(userId: string, displayName: string, session: MeetingSession) {
  session.speakerNames[userId] = displayName

  const isNew = !session.knownSpeakers.has(userId)
  if (isNew) {
    session.knownSpeakers.add(userId)
    broadcast({ type: 'blop_event', event: 'new_speaker', speaker: displayName, blopDelta: 5, message: `${displayName} vient de prendre la parole !` })
  }

  session.activeSpeaker = displayName
  session.activeSpeakerStart = Date.now()
  session.lastSpeechAt = Date.now()
  session.lastDominanceAlertAt = null
  session.lastSilenceAlertAt = null
  broadcast({ type: 'speaker_change', current: displayName })
}

export function onSpeakerEnd(userId: string, seconds: number, session: MeetingSession) {
  session.speakerSeconds[userId] = (session.speakerSeconds[userId] ?? 0) + seconds
  session.activeSpeaker = null
  session.activeSpeakerStart = null
}
