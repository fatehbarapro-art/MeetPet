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
  isBlop?: boolean
}

export interface Action {
  id: string
  text: string
  assignee: string
  deadline: string | null
  status: 'pending' | 'done' | 'overdue'
  confidence: number
}

export interface MeetingState {
  meetingId: string | null
  title: string
  isActive: boolean
  startedAt: number | null
  participants: string[]
  activeSpeaker: string | null
  speakerTime: Record<string, number>
  transcript: TranscriptSegment[]
  actions: Action[]
  blopState: BlopState
  blopSpeech: string | null
}
