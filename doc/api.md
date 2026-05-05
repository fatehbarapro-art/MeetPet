# APIs IA — Configuration et usage

> Dernière mise à jour : 2026-05-05
> Sponsor : **MiniMax** | Stack : MiniMax + Groq uniquement

---

## Récapitulatif

| Rôle | Modèle | Base URL | Auth |
|---|---|---|---|
| STT (Discord → texte) | `whisper-large-v3` | `https://api.groq.com/openai/v1` | Groq API key (gratuit) |
| Analyse 30s + compte-rendu | `MiniMax-M2.7-highspeed` | `https://api.minimax.io/v1` | MiniMax API key |
| TTS (Blop parle) | `speech-2.8-turbo` | `https://api.minimax.io/v1` | MiniMax API key |
| Micro-events | Rule-based local | — | — |

---

## Groq — STT Whisper

### Obtenir la clé (gratuit)
1. Créer un compte sur groq.com
2. "API Keys" → créer une clé
3. Tier gratuit : 7200 secondes audio / heure

### Configuration

```typescript
// utils/groq.ts
import OpenAI from 'openai'
import fs from 'fs'

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY!,
  baseURL: 'https://api.groq.com/openai/v1',
})

export async function transcribeAudio(
  pcmBuffer: Buffer,
  speakerName: string
): Promise<{ text: string; speaker: string }> {
  // Groq accepte wav/mp3/ogg — on wrape le PCM en WAV
  const wavBuffer = pcmToWav(pcmBuffer, 16000)
  
  const file = new File([wavBuffer], 'audio.wav', { type: 'audio/wav' })
  
  const transcription = await groq.audio.transcriptions.create({
    file,
    model: 'whisper-large-v3',
    language: 'fr',
    response_format: 'text',
  })

  return { text: transcription as string, speaker: speakerName }
}

function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataSize = pcm.length
  const header = Buffer.alloc(44)

  header.write('RIFF', 0)
  header.writeUInt32LE(36 + dataSize, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)               // PCM
  header.writeUInt16LE(numChannels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36)
  header.writeUInt32LE(dataSize, 40)

  return Buffer.concat([header, pcm])
}
```

---

## MiniMax — Texte (M2.7-highspeed)

### Obtenir la clé
Après check-in create.gosim.org → "API Credits" (coin bas-gauche) → code de rédemption MiniMax.
Rédimer sur platform.minimax.io → copier l'API key.

### Analyse toutes les 30s

```typescript
// utils/minimax.ts
import OpenAI from 'openai'

const minimax = new OpenAI({
  apiKey: process.env.MINIMAX_API_KEY!,
  baseURL: 'https://api.minimax.io/v1',
})

export async function analyzeTranscript(transcript: string): Promise<MeetingAnalysis> {
  const response = await minimax.chat.completions.create({
    model: 'MiniMax-M2.7-highspeed',
    messages: [
      { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
      { role: 'user', content: `Transcription :\n${transcript}` }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 1000,
  })
  return JSON.parse(response.choices[0].message.content!)
}
```

### Prompt système — Analyse 30s

```
Tu es l'analyseur de réunion de MeetPet. Analyse la transcription fournie et retourne UNIQUEMENT du JSON valide sans markdown ni explication.

Format de réponse obligatoire :
{
  "actions": [
    { "text": string, "assignee": string, "deadline": string|null, "confidence": number }
  ],
  "decisions": [string],
  "speakingTime": { "[displayName]": number },
  "dominanceAlert": { "speaker": string, "minutes": number } | null,
  "blopMood": {
    "energy": number,
    "balance": number,
    "focus": number,
    "happiness": number,
    "reason": string
  }
}

Règles :
- speakingTime : proportion 0-1, la somme doit être ≈ 1
- confidence : 0-1 (probabilité que ce soit une vraie action)
- deadline : format ISO 8601 (YYYY-MM-DD) ou null
- Tous les scores blopMood : 0-100
- Si pas d'action détectée : "actions": []
```

### Génération compte-rendu (fin de réunion)

```typescript
export async function generateSummary(
  transcript: string,
  actions: Action[],
  speakers: Speaker[]
): Promise<string> {
  const response = await minimax.chat.completions.create({
    model: 'MiniMax-M2.7-highspeed',
    messages: [
      { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
      { role: 'user', content: `
Transcription complète :
${transcript}

Speakers et temps de parole :
${JSON.stringify(speakers)}

Actions détectées :
${JSON.stringify(actions)}
      `}
    ],
    temperature: 0.3,
    max_tokens: 2000,
  })
  return response.choices[0].message.content!
}
```

### Prompt système — Compte-rendu

```
Tu es le générateur de compte-rendu de MeetPet. Génère un compte-rendu en Markdown structuré.

Structure obligatoire :
## [Titre réunion] — [date] ([durée])

### Participants
- [Nom] ([%] du temps de parole) — ⚠️ si > 50%

### Décisions
- [décision]

### Actions
| Action | Assigné à | Deadline | Statut |
|---|---|---|---|
| ... | ... | ... | ✅ / 🔴 / ⏳ |

### État de Blop
[Mood] ([score]/100). [Raison]. [Objectif pour la prochaine réunion].

Ton : professionnel mais direct. Mentionne Blop comme un membre de l'équipe.
```

---

## MiniMax — TTS (speech-2.8-turbo)

```typescript
export async function synthesizeSpeech(text: string): Promise<Buffer> {
  const response = await fetch(`https://api.minimax.io/v1/t2a_v2`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.MINIMAX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'speech-2.8-turbo',
      text,
      stream: false,
      voice_setting: {
        voice_id: 'female-youthful',  // voix de Blop — voir liste des 332 voix
        speed: 1.1,
        vol: 1.0,
        pitch: 2,                      // légèrement plus aigu = Blop
      },
      audio_setting: {
        sample_rate: 32000,
        bitrate: 128000,
        format: 'mp3',
      }
    })
  })

  const data = await response.json()
  return Buffer.from(data.data.audio, 'hex')
}
```

> ⚠️ L'endpoint TTS exact (`/t2a_v2` ou `/audio/speech`) sera confirmé avec la doc MiniMax sur place.
> En cas de problème : envoyer le texte Blop en message Discord texte uniquement (fallback 0 code).

---

## Micro-events — Rule-based (0 API call)

```typescript
// services/eventService.ts

interface MeetingState {
  speakerTimers: Map<string, number>  // userId → secondes de parole
  activeSpeaker: string | null
  activeSpeakerStart: number | null   // timestamp début du segment actif
  lastSpeechAt: number
  knownSpeakers: Set<string>
}

export function onSpeakerStart(userId: string, displayName: string, state: MeetingState) {
  // Nouveau speaker jamais vu → +5 bonheur
  if (!state.knownSpeakers.has(userId)) {
    state.knownSpeakers.add(userId)
    broadcast({ type: 'blop_event', event: 'new_speaker', speaker: displayName, blopDelta: +5 })
  }

  state.activeSpeaker = userId
  state.activeSpeakerStart = Date.now()
  state.lastSpeechAt = Date.now()
  broadcast({ type: 'speaker_change', current: displayName })
}

export function checkDominance(state: MeetingState) {
  // Appelé toutes les 30s
  if (!state.activeSpeaker || !state.activeSpeakerStart) return

  const minutes = (Date.now() - state.activeSpeakerStart) / 60000
  if (minutes >= 5) {
    broadcast({ type: 'dominance_alert', speaker: state.activeSpeaker, minutes: Math.round(minutes) })
    // → trigger Blop intervention vocale
  }

  // Silence > 2 min
  const silenceMin = (Date.now() - state.lastSpeechAt) / 60000
  if (silenceMin >= 2) {
    broadcast({ type: 'blop_event', event: 'silence', blopDelta: -5 })
  }
}
```

---

## Fallbacks

| Service | Problème | Fallback |
|---|---|---|
| Groq STT | Rate limit (rare) | Buffering + retry 5s |
| MiniMax analyse | JSON malformé | Retry `temperature: 0` + prompt simplifié |
| MiniMax TTS | Timeout | Message texte Discord uniquement |
| MiniMax text | Quota épuisé | Réduire fréquence analyse à 60s |

---

## Types TypeScript

```typescript
// types/index.ts

export interface MeetingAnalysis {
  actions: Array<{
    text: string
    assignee: string
    deadline: string | null
    confidence: number
  }>
  decisions: string[]
  speakingTime: Record<string, number>  // displayName → 0-1
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

export interface Action {
  id: string
  text: string
  assignee: string
  deadline: string | null
  status: 'pending' | 'done' | 'overdue'
  confidence: number
}

export interface Speaker {
  name: string
  discordUserId: string
  talkPercent: number
  talkSeconds: number
}
```
