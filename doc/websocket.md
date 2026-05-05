# Protocole WebSocket

> Dernière mise à jour : 2026-05-05
> WebSocket connecte le backend Node.js au frontend React uniquement.
> Discord est géré côté backend directement (pas via WebSocket frontend).

---

## Connexion

```
ws://localhost:3000
```

Le client frontend se connecte au démarrage et maintient la connexion ouverte pendant toute la réunion.

---

## Backend → Frontend (événements entrants)

### `transcript`
Nouveau segment de transcription reçu.
```typescript
{
  type: 'transcript',
  speaker: string,       // displayName Discord
  text: string,          // texte transcrit
  timestamp: number,     // Unix ms
  isFinal: boolean       // false si en cours, true si segment terminé
}
```

### `action_detected`
Kimi a détecté une nouvelle action.
```typescript
{
  type: 'action_detected',
  action: {
    id: string,
    text: string,
    assignee: string,
    deadline: string | null,  // ISO 8601
    confidence: number
  }
}
```

### `blop_update`
Mise à jour de l'état de Blop (toutes les 30s ou après un micro-event).
```typescript
{
  type: 'blop_update',
  state: {
    energy: number,     // 0-100
    balance: number,    // 0-100
    focus: number,      // 0-100
    happiness: number,  // 0-100
    mood: 'euphoric' | 'happy' | 'stressed' | 'sad' | 'distressed',
    reason?: string
  }
}
```

### `blop_speech`
Blop prend la parole (joué dans Discord vocal + affiché frontend).
```typescript
{
  type: 'blop_speech',
  text: string,          // texte de l'intervention
  trigger: string        // raison : 'dominance' | 'overdue' | 'silence' | 'celebration' | 'end'
}
```

### `dominance_alert`
Un speaker monopolise la parole.
```typescript
{
  type: 'dominance_alert',
  speaker: string,
  minutes: number
}
```

### `blop_event`
Micro-event positif ou négatif.
```typescript
{
  type: 'blop_event',
  event: 'new_speaker' | 'action_completed' | 'conflict_detected' | 'positive_moment',
  speaker?: string,
  blopDelta: number,     // variation happiness (-10 à +10)
  message?: string       // message à afficher dans le transcript
}
```

### `speaker_change`
Changement de locuteur actif.
```typescript
{
  type: 'speaker_change',
  current: string        // displayName du locuteur actif
}
```

### `meeting_started`
Réunion démarrée (confirmation).
```typescript
{
  type: 'meeting_started',
  meetingId: string,
  title: string,
  participants: string[]
}
```

### `meeting_ended`
Réunion terminée.
```typescript
{
  type: 'meeting_ended',
  meetingId: string,
  summaryUrl: string     // /summary/:id
}
```

---

## Frontend → Backend (événements sortants)

> Note : avec Discord, la plupart des actions sont déclenchées par des slash commands.
> Le WebSocket frontend sert surtout à confirmer des actions depuis l'interface.

### `action_complete`
Un utilisateur marque une action comme terminée depuis l'interface.
```typescript
{
  type: 'action_complete',
  actionId: string
}
```

### `meeting_end`
Fin de réunion déclenchée depuis l'interface (bouton "Fin").
```typescript
{
  type: 'meeting_end'
}
```

---

## Implémentation backend

```typescript
// server.ts
import { WebSocketServer, WebSocket } from 'ws'

const wss = new WebSocketServer({ server: httpServer })
const clients = new Set<WebSocket>()

wss.on('connection', (ws) => {
  clients.add(ws)
  ws.on('close', () => clients.delete(ws))
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString())
    handleWsMessage(msg)
  })
})

export function broadcast(event: object) {
  const json = JSON.stringify(event)
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(json)
    }
  }
}
```

---

## Implémentation frontend (hook)

```typescript
// hooks/useWebSocket.ts
import { useEffect } from 'react'
import { useMeetingStore } from '../store'

export function useWebSocket() {
  const { setTranscript, setBlopState, addAction, setActiveSpeaker } = useMeetingStore()

  useEffect(() => {
    const ws = new WebSocket(import.meta.env.VITE_WS_URL)

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      switch (msg.type) {
        case 'transcript':
          setTranscript(prev => [...prev, msg])
          break
        case 'blop_update':
          setBlopState(msg.state)
          break
        case 'action_detected':
          addAction(msg.action)
          break
        case 'speaker_change':
          setActiveSpeaker(msg.current)
          break
        case 'meeting_ended':
          window.location.href = msg.summaryUrl
          break
      }
    }

    return () => ws.close()
  }, [])
}
```
