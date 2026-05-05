import OpenAI from 'openai'
import type { MeetingAnalysis } from '../types/index.js'

const MOCK = !process.env.MINIMAX_API_KEY || process.env.MINIMAX_API_KEY === 'mock'

const minimax = MOCK ? null : new OpenAI({
  apiKey: process.env.MINIMAX_API_KEY!,
  baseURL: 'https://api.minimax.io/v1',
})

if (MOCK) console.log('⚠️  MiniMax en mode MOCK (pas de clé API)')

// --- MOCKS ---

function mockAnalysis(transcript: string): MeetingAnalysis {
  const speakers = [...new Set(transcript.match(/^(\w[\w\s]+):/gm)?.map(s => s.replace(':', '').trim()) ?? ['Speaker'])]
  const n = speakers.length || 1
  const speakingTime = Object.fromEntries(speakers.map((s, i) => [s, i === 0 ? 0.6 : 0.4 / (n - 1)]))

  return {
    actions: [
      { text: '[MOCK] Préparer la démo pour vendredi', assignee: speakers[0], deadline: '2026-05-08', confidence: 0.9 },
    ],
    decisions: ['[MOCK] Budget validé à 500€/mois'],
    speakingTime,
    dominanceAlert: speakers[0] ? { speaker: speakers[0], minutes: 6 } : null,
    blopMood: { energy: 70, balance: 45, focus: 60, happiness: 52, reason: '[MOCK] Déséquilibre de parole détecté' },
  }
}

function mockSummary(title: string, durationMin: number): string {
  return `## ${title} — ${new Date().toLocaleDateString('fr-FR')} (${durationMin} min)

### Participants
- Speaker A (60% du temps de parole) ⚠️
- Speaker B (40%)

### Décisions
- [MOCK] Budget API validé à 500€/mois

### Actions
| Action | Assigné à | Deadline | Statut |
|---|---|---|---|
| Préparer la démo | Speaker A | Vendredi 08/05 | ⏳ À faire |

### État de Blop
Stressé (52/100). Déséquilibre de parole détecté. Objectif : mieux répartir la parole.

> ⚠️ Compte-rendu généré en mode MOCK — clé MiniMax non configurée.`
}

// --- PROMPTS ---

const ANALYSIS_PROMPT = `Tu es l'analyseur de réunion de MeetPet. Analyse la transcription fournie et retourne UNIQUEMENT du JSON valide sans markdown ni explication.

Format de réponse obligatoire :
{
  "actions": [{ "text": string, "assignee": string, "deadline": string|null, "confidence": number }],
  "decisions": [string],
  "speakingTime": { "[displayName]": number },
  "dominanceAlert": { "speaker": string, "minutes": number } | null,
  "blopMood": { "energy": number, "balance": number, "focus": number, "happiness": number, "reason": string }
}

Règles :
- speakingTime : proportion 0-1, somme ≈ 1
- confidence : 0-1
- deadline : ISO 8601 (YYYY-MM-DD) ou null
- Tous les scores blopMood : 0-100
- Si pas d'action : "actions": []`

const SUMMARY_PROMPT = `Tu es le générateur de compte-rendu de MeetPet. Génère un compte-rendu en Markdown structuré.

Structure :
## [Titre] — [date] ([durée])
### Participants
- [Nom] ([%] temps de parole)
### Décisions
- [décision]
### Actions
| Action | Assigné à | Deadline | Statut |
|---|---|---|---|
### État de Blop
[mood] ([score]/100). [Raison]. [Objectif prochaine réunion].

Ton : professionnel mais direct. Mentionne Blop comme membre de l'équipe.`

// --- EXPORTS ---

export async function analyzeTranscript(transcript: string): Promise<MeetingAnalysis> {
  if (MOCK) return mockAnalysis(transcript)

  const response = await minimax!.chat.completions.create({
    model: 'MiniMax-M2.7-highspeed',
    messages: [
      { role: 'system', content: ANALYSIS_PROMPT },
      { role: 'user', content: `Transcription :\n${transcript}` },
    ],
    // @ts-ignore
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 1000,
  })

  try {
    return JSON.parse(response.choices[0].message.content!) as MeetingAnalysis
  } catch {
    const retry = await minimax!.chat.completions.create({
      model: 'MiniMax-M2.7-highspeed',
      messages: [
        { role: 'system', content: ANALYSIS_PROMPT + "\nRéponds UNIQUEMENT avec du JSON, rien d'autre." },
        { role: 'user', content: `Transcription :\n${transcript}` },
      ],
      temperature: 0,
      max_tokens: 1000,
    })
    return JSON.parse(retry.choices[0].message.content!) as MeetingAnalysis
  }
}

export async function generateSummary(
  transcript: string,
  title: string,
  durationMin: number
): Promise<string> {
  if (MOCK) return mockSummary(title, durationMin)

  const response = await minimax!.chat.completions.create({
    model: 'MiniMax-M2.7-highspeed',
    messages: [
      { role: 'system', content: SUMMARY_PROMPT },
      { role: 'user', content: `Titre : ${title}\nDurée : ${durationMin} minutes\n\nTranscription :\n${transcript}` },
    ],
    temperature: 0.3,
    max_tokens: 2000,
  })
  return response.choices[0].message.content!
}

export async function synthesizeSpeech(text: string): Promise<Buffer> {
  if (MOCK) {
    console.log(`🔇 [MOCK TTS] Blop dirait : "${text}"`)
    throw new Error('MOCK: pas de TTS sans clé MiniMax')
  }

  const response = await fetch('https://api.minimax.io/v1/t2a_v2', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MINIMAX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'speech-2.8-turbo',
      text,
      stream: false,
      voice_setting: { voice_id: 'female-youthful', speed: 1.1, vol: 1.0, pitch: 2 },
      audio_setting: { sample_rate: 32000, bitrate: 128000, format: 'mp3' },
    }),
  })

  const data = await response.json() as { data?: { audio?: string } }
  if (!data.data?.audio) throw new Error('MiniMax TTS: no audio in response')
  return Buffer.from(data.data.audio, 'hex')
}
