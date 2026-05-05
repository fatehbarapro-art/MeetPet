import { useEffect, useRef } from 'react'
import { useMeetingStore } from '../store.ts'

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3000'

export function useWebSocket() {
  const store = useMeetingStore()
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => console.log('WS connecté')
    ws.onclose = () => console.log('WS déconnecté')

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      switch (msg.type) {
        case 'transcript':
          store.addTranscript({ speaker: msg.speaker, text: msg.text, timestamp: msg.timestamp })
          store.setActiveSpeaker(msg.speaker)
          break
        case 'blop_update':
          store.setBlopState(msg.state)
          break
        case 'action_detected':
          store.addAction(msg.action)
          break
        case 'blop_speech':
          store.addTranscript({ speaker: '🎙️ Blop', text: msg.text, timestamp: Date.now(), isBlop: true })
          store.setBlopSpeech(msg.text)
          setTimeout(() => store.setBlopSpeech(null), 5000)
          break
        case 'blop_event':
          if (msg.message) {
            store.addTranscript({ speaker: '✨ Blop', text: msg.message, timestamp: Date.now(), isBlop: true })
          }
          break
        case 'speaker_change':
          store.setActiveSpeaker(msg.current)
          break
        case 'meeting_started':
          store.setMeeting({ meetingId: msg.meetingId, title: msg.title, participants: msg.participants })
          break
        case 'meeting_ended':
          window.location.href = `/summary/${msg.meetingId}`
          break
      }
    }

    return () => ws.close()
  }, [])

  const send = (event: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(event))
    }
  }

  return { send }
}
