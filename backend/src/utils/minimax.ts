import OpenAI from 'openai'
import type { MeetingAnalysis } from '../types/index.js'

const minimax = new OpenAI({
  apiKey: process.env.MINIMAX_API_KEY!,
  baseURL: 'https://api.minimax.io/v1',
})

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

export async function analyzeTranscript(transcript: string): Promise<MeetingAnalysis> {
  const response = await minimax.chat.completions.create({
    model: 'MiniMax-M2.7-highspeed',
    messages: [
      { role: 'system', content: ANALYSIS_PROMPT },
      { role: 'user', content: `Transcription :\n${transcript}` },
    ],
    // @ts-ignore — MiniMax supporte json_object via leur implémentation OpenAI-compat
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 1000,
  })

  try {
    return JSON.parse(response.choices[0].message.content!) as MeetingAnalysis
  } catch {
    // Retry sans json_object si malformé
    const retry = await minimax.chat.completions.create({
      model: 'MiniMax-M2.7-highspeed',
      messages: [
        { role: 'system', content: ANALYSIS_PROMPT + '\nRéponds UNIQUEMENT avec du JSON, rien d\'autre.' },
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
  const response = await minimax.chat.completions.create({
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
      voice_setting: {
        voice_id: 'female-youthful',
        speed: 1.1,
        vol: 1.0,
        pitch: 2,
      },
      audio_setting: {
        sample_rate: 32000,
        bitrate: 128000,
        format: 'mp3',
      },
    }),
  })

  const data = await response.json() as { data?: { audio?: string } }
  if (!data.data?.audio) throw new Error('MiniMax TTS: no audio in response')
  return Buffer.from(data.data.audio, 'hex')
}
