export interface MeetingAnalysis {
  actions: Array<{
    text: string
    assignee: string
    deadline: string | null
    confidence: number
  }>
  decisions: string[]
  speakingTime: Record<string, number>
  dominanceAlert: { speaker: string; minutes: number } | null
  blopMood: {
    energy: number
    balance: number
    focus: number
    happiness: number
    reason: string
  }
}

export interface BlopState {
  energy: number
  balance: number
  focus: number
  happiness: number
  level: number
  mood: 'euphoric' | 'happy' | 'stressed' | 'sad' | 'distressed'
  reason?: string
}

export interface TranscriptSegment {
  speaker: string
  text: string
  timestamp: number
}

export interface MeetingSession {
  id: string
  title: string
  guildId: string
  voiceChannelId: string
  textChannelId: string
  startedAt: number
  transcript: TranscriptSegment[]
  speakerSeconds: Record<string, number>
  speakerNames: Record<string, string>
  knownSpeakers: Set<string>
  activeSpeaker: string | null
  activeSpeakerStart: number | null
  lastDominanceAlertAt: number | null
  lastSilenceAlertAt: number | null
  lastSpeechAt: number
  blopState: BlopState
  analysisTimer?: ReturnType<typeof setInterval>
  eventTimer?: ReturnType<typeof setInterval>
}

export type WsEvent =
  | { type: 'transcript'; speaker: string; text: string; timestamp: number }
  | { type: 'action_detected'; action: { id: string; text: string; assignee: string; deadline: string | null; confidence: number } }
  | { type: 'blop_update'; state: BlopState }
  | { type: 'blop_speech'; text: string; trigger: string }
  | { type: 'blop_event'; event: string; speaker?: string; blopDelta: number; message?: string }
  | { type: 'dominance_alert'; speaker: string; minutes: number }
  | { type: 'speaker_change'; current: string }
  | { type: 'meeting_started'; meetingId: string; title: string; participants: string[] }
  | { type: 'meeting_ended'; meetingId: string; summaryUrl: string }
