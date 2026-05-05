import { create } from 'zustand'
import type { BlopState, TranscriptSegment, Action, MeetingState } from './types/index.ts'

const DEFAULT_BLOP: BlopState = {
  energy: 80, balance: 80, focus: 80, happiness: 80, level: 1, mood: 'happy'
}

interface Store extends MeetingState {
  addTranscript: (segment: TranscriptSegment) => void
  setBlopState: (state: BlopState) => void
  addAction: (action: Action) => void
  setActiveSpeaker: (speaker: string | null) => void
  setBlopSpeech: (text: string | null) => void
  setMeeting: (data: { meetingId: string; title: string; participants: string[] }) => void
  updateActionStatus: (id: string, status: Action['status']) => void
}

export const useMeetingStore = create<Store>((set) => ({
  meetingId: null,
  title: 'MeetPet',
  isActive: false,
  startedAt: null,
  participants: [],
  activeSpeaker: null,
  speakerTime: {},
  transcript: [],
  actions: [],
  blopState: DEFAULT_BLOP,
  blopSpeech: null,

  addTranscript: (segment) =>
    set((s) => ({ transcript: [...s.transcript, segment] })),

  setBlopState: (state) =>
    set({ blopState: state }),

  addAction: (action) =>
    set((s) => {
      if (s.actions.find((a) => a.id === action.id)) return s
      return { actions: [...s.actions, action] }
    }),

  setActiveSpeaker: (speaker) =>
    set((s) => {
      if (!speaker) return { activeSpeaker: null }
      const speakerTime = { ...s.speakerTime }
      speakerTime[speaker] = (speakerTime[speaker] ?? 0) + 1
      return { activeSpeaker: speaker, speakerTime }
    }),

  setBlopSpeech: (text) => set({ blopSpeech: text }),

  setMeeting: ({ meetingId, title, participants }) =>
    set({ meetingId, title, participants, isActive: true, startedAt: Date.now() }),

  updateActionStatus: (id, status) =>
    set((s) => ({
      actions: s.actions.map((a) => (a.id === id ? { ...a, status } : a)),
    })),
}))
