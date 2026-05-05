# Architecture MeetPet

> Dernière mise à jour : 2026-05-05
> Stack finale — hackathon simplifié, 2 clés API

---

## Stack technique

| Couche | Technologie | Justification |
|---|---|---|
| Runtime | Node.js 20 + TypeScript | Typage fort, ecosystem riche |
| API REST | Express 4 | Léger, suffisant pour le hackathon |
| Temps réel | WebSocket (`ws`) | Streaming audio + events Blop |
| ORM | Prisma + SQLite | Zero config, persistance simple |
| Discord | `discord.js` v14 + `@discordjs/voice` | Audio par speaker natif |
| Frontend | React 18 + Vite + Tailwind | Rapide à bootstrapper |
| State FE | Zustand | Léger, pas de boilerplate |
| Animation | Canvas 2D API | Blop animé frame par frame |

## Modèles IA

| Rôle | Modèle | API | Coût |
|---|---|---|---|
| STT (Discord → texte) | Whisper large-v3 | Groq (gratuit) | $0 |
| Analyse 30s + compte-rendu | MiniMax-M2.7-highspeed | MiniMax | Crédits hackathon |
| TTS (Blop parle) | speech-2.8-turbo | MiniMax | Crédits hackathon |
| Micro-events | Rule-based (local) | — | $0 |

> Pas de DeepSeek. Pas de RouteTokens. Stack = MiniMax + Groq.

---

## Structure des fichiers

```
meetpet/
├── doc/                        ← Documentation IA (ce répertoire)
│
├── backend/
│   ├── src/
│   │   ├── server.ts                # Entry point Express + WS
│   │   ├── routes/
│   │   │   ├── meetings.ts          # CRUD réunions
│   │   │   ├── actions.ts           # CRUD actions
│   │   │   └── blop.ts              # État et historique Blop
│   │   ├── services/
│   │   │   ├── audioService.ts      # Pipeline Discord → Groq STT
│   │   │   ├── analysisService.ts   # MiniMax M2.7 (actions, mood, compte-rendu)
│   │   │   ├── eventService.ts      # Micro-events rule-based (local, 0 API)
│   │   │   ├── blopService.ts       # Logique état/humeur/évolution Blop
│   │   │   ├── meetingService.ts    # Orchestration réunion
│   │   │   └── summaryService.ts    # Compte-rendu MiniMax M2.7
│   │   ├── integrations/
│   │   │   └── discord/
│   │   │       ├── discordBot.ts       # Client discord.js + voice
│   │   │       ├── discordCommands.ts  # /meetpet start|stop|status|actions
│   │   │       └── discordEmbeds.ts    # Embeds formatés compte-rendu
│   │   ├── utils/
│   │   │   ├── minimax.ts      # MiniMax M2.7-highspeed (text) + speech-2.8-turbo (TTS)
│   │   │   └── groq.ts         # Groq Whisper STT
│   │   └── types/
│   │       └── index.ts        # Types partagés backend
│   ├── prisma/
│   │   └── schema.prisma
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── MeetingRoom/
│   │   │   │   ├── MeetingRoom.tsx    # Composant principal
│   │   │   │   ├── Header.tsx         # Timer, titre, statut
│   │   │   │   ├── SpeakerBars.tsx    # Barres temps de parole
│   │   │   │   ├── ActionsList.tsx    # Actions détectées
│   │   │   │   ├── Transcript.tsx     # Transcription + interventions Blop
│   │   │   │   └── BottomBar.tsx      # Statut écoute, fin réunion
│   │   │   ├── Blop/
│   │   │   │   ├── BlopCanvas.tsx     # Animation Canvas 60fps
│   │   │   │   ├── BlopStats.tsx      # Barres énergie/équilibre/focus/bonheur
│   │   │   │   └── BlopSpeech.tsx     # Bulle de dialogue
│   │   │   ├── Dashboard/
│   │   │   │   ├── Dashboard.tsx      # Historique des réunions
│   │   │   │   └── TeamStats.tsx      # Stats équipe
│   │   │   └── Summary/
│   │   │       ├── MeetingSummary.tsx # Compte-rendu post-réunion
│   │   │       └── ActionTracker.tsx  # Suivi actions inter-réunions
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts    # Connexion WS + routing events
│   │   │   ├── useMeeting.ts      # État réunion en cours
│   │   │   └── useBlop.ts         # État + animation Blop
│   │   ├── services/
│   │   │   └── api.ts             # Appels REST backend
│   │   └── types/
│   │       └── index.ts           # Types TypeScript partagés FE
│   ├── package.json
│   └── vite.config.ts
│
├── .env.example
├── .gitignore
└── README.md
```

---

## Flux de données principal

```
[Discord Voice Channel]
        │ AudioReceiveStream par userId
        ▼
[discordBot.ts] ──OpusDecoder──► PCM 16kHz mono
        │
        ▼
[audioService.ts] ──► Groq Whisper STT ──► { text, userId }
        │
        ├──► transcription accumulée (buffer 30s)
        │         │
        │         ▼
        │    [analysisService.ts] ──► MiniMax M2.7-highspeed
        │         │                    └─► JSON: actions, speakingTime, blopMood
        │
        ├──► [eventService.ts] ──► Rule-based (local, 0ms latence)
        │         │                  new_speaker / dominance / silence
        │
        ├──► [blopService.ts] ──► calcul happiness/mood
        │
        ▼
[WebSocket broadcast] ──► Frontend React
        │
        ├── transcript → Transcript.tsx
        ├── blop_update → BlopCanvas.tsx (animation)
        ├── action_detected → ActionsList.tsx
        └── blop_speech → MiniMax TTS → audio joué dans Discord + bulle BlopSpeech.tsx
```

---

## Variables d'environnement

```env
# Serveur
PORT=3000
NODE_ENV=development

# Base de données
DATABASE_URL="file:./dev.db"

# Discord
DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=          # Pour enregistrer les slash commands en dev

# MiniMax (sponsor hackathon — code de rédemption create.gosim.org)
MINIMAX_API_KEY=
MINIMAX_GROUP_ID=
MINIMAX_BASE_URL=https://api.minimax.io/v1

# Groq (STT Whisper — gratuit sur groq.com)
GROQ_API_KEY=

# Frontend
VITE_WS_URL=ws://localhost:3000
VITE_API_URL=http://localhost:3000/api
```

---

## Clients API

```typescript
// utils/minimax.ts — text M2.7 + TTS speech-2.8-turbo
import OpenAI from 'openai'

const minimax = new OpenAI({
  apiKey: process.env.MINIMAX_API_KEY!,
  baseURL: 'https://api.minimax.io/v1',  // OpenAI-compatible
})
export default minimax

// utils/groq.ts — Whisper STT
import OpenAI from 'openai'

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY!,
  baseURL: 'https://api.groq.com/openai/v1',  // OpenAI-compatible
})
export default groq
```

> Les deux clients utilisent le SDK OpenAI standard avec `baseURL` custom — zéro friction.

---

## Dépendances backend

```json
{
  "dependencies": {
    "express": "^4.18",
    "ws": "^8.16",
    "@prisma/client": "^5.13",
    "openai": "^4.47",
    "discord.js": "^14.15",
    "@discordjs/voice": "^0.17",
    "@discordjs/opus": "^0.9",
    "dotenv": "^16.4",
    "sodium-native": "^4.1"
  },
  "devDependencies": {
    "prisma": "^5.13",
    "typescript": "^5.4",
    "tsx": "^4.9",
    "@types/express": "^4.17",
    "@types/ws": "^8.5",
    "@types/node": "^20"
  }
}
```

> ⚠️ `@discordjs/opus` et `sodium-native` nécessitent une compilation native (node-gyp).
> Fallback si problème : `opusscript` + `libsodium-wrappers`.
