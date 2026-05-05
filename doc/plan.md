# Plan de développement MeetPet — 24h Hackathon

> Dernière mise à jour : 2026-05-05
> Stack finale : MiniMax (text + TTS) + Groq Whisper (STT) + Discord

---

## Stack IA résumée

| Rôle | Modèle | Justification |
|---|---|---|
| STT | Groq Whisper large-v3 | Gratuit, OpenAI-compat, ~250ms |
| Analyse + compte-rendu | MiniMax M2.7-highspeed | Sponsor hackathon, 204k ctx, 100 tps |
| TTS Blop | MiniMax speech-2.8-turbo | 40 langues, 7 émotions, WebSocket stream |
| Micro-events | Rule-based local | 0 API, 0 latence |

## Avantage Discord

Discord fournit **un flux audio séparé par utilisateur** → diarisation native, chaque speaker est déjà isolé.

```
Discord Voice Channel
  ├── User A → AudioReceiveStream → OpusDecoder → PCM → Groq Whisper
  ├── User B → AudioReceiveStream → OpusDecoder → PCM → Groq Whisper
  └── User C → AudioReceiveStream → OpusDecoder → PCM → Groq Whisper
```

---

## Étape 1 — Scaffolding & Infrastructure (0h → 3h)

### Objectif
Repo propre, backend qui tourne, frontend qui s'affiche, Discord bot connecté.

### Livrables
- [ ] GitHub repo public + `LICENSE` MIT + `README.md` squelette
- [ ] `backend/` : init npm, deps installées, TypeScript configuré
- [ ] `frontend/` : Vite + React + Tailwind opérationnel
- [ ] Schéma Prisma créé + `npx prisma db push` qui passe
- [ ] `.env.example` complet
- [ ] Serveur Express démarré sur port 3000
- [ ] WebSocket handler basique (routing par `type`)
- [ ] Bot Discord connecté (`discord.js`) — apparaît en ligne dans le serveur
- [ ] Slash commands Discord enregistrées (dev guild)
- [ ] `utils/minimax.ts` initialisé (client OpenAI → baseURL minimax.io)
- [ ] `utils/groq.ts` initialisé (client OpenAI → baseURL groq.com)

### Dépendances backend
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

### Dépendances frontend
```json
{
  "dependencies": {
    "react": "^18",
    "react-dom": "^18",
    "zustand": "^4.5",
    "tailwindcss": "^3.4"
  }
}
```

---

## Étape 2 — Pipeline Audio Discord (3h → 8h)

### Objectif
Bot Discord rejoint le vocal → capture audio par speaker → transcription temps réel via Groq Whisper.

### Livrables
- [ ] `/meetpet start` → bot rejoint le voice channel
- [ ] `AudioReceiveStream` par membre présent dans le channel
- [ ] Décodage Opus → PCM 16kHz mono via `OpusDecoder`
- [ ] PCM wrappé en WAV → envoi Groq Whisper STT par speaker
- [ ] Résultat transcription → broadcast WS → `Transcript.tsx` affiché en temps réel
- [ ] Speaker change event → mise à jour `SpeakerBars.tsx`
- [ ] `/meetpet stop` → bot quitte
- [ ] Speakers sauvegardés en SQLite à la fin

### Flow technique
```typescript
connection.receiver.speaking.on('start', (userId) => {
  const displayName = channel.members.get(userId)?.displayName ?? userId
  const stream = receiver.subscribe(userId, { end: { behavior: EndBehaviorType.AfterSilence, duration: 500 } })
  const decoder = new OpusDecoder()
  const chunks: Buffer[] = []

  stream.pipe(decoder)
  decoder.on('data', (chunk: Buffer) => chunks.push(chunk))
  stream.on('end', async () => {
    const pcm = Buffer.concat(chunks)
    const { text } = await transcribeAudio(pcm, displayName)  // Groq Whisper
    if (text.trim()) broadcast({ type: 'transcript', speaker: displayName, text, timestamp: Date.now() })
  })
})
```

---

## Étape 3 — Intelligence MiniMax M2.7 (8h → 13h)

### Objectif
Extraction automatique d'actions + calcul état Blop toutes les 30 secondes.

### Livrables
- [ ] Accumulateur de transcription (30s sliding window)
- [ ] Appel MiniMax M2.7-highspeed → JSON structuré (actions, temps de parole, mood Blop)
- [ ] Parsing + validation du JSON retourné (try/catch + retry si malformé)
- [ ] Persistance SQLite : `Action`, `Speaker`, `BlopState`
- [ ] Calcul score Blop (voir [blop.md](blop.md) pour la formule)
- [ ] Broadcast WS : `blop_update`, `action_detected`, `dominance_alert`
- [ ] `eventService.ts` rule-based : new_speaker, dominance, silence (0 API call)
- [ ] `ActionsList.tsx` affiche les actions avec statut

---

## Étape 4 — Blop animé Canvas (13h → 17h)

### Objectif
Blop vit à l'écran, réagit visuellement à chaque changement d'état.

### Livrables
- [ ] `BlopCanvas.tsx` : boucle 60fps avec `requestAnimationFrame`
- [ ] Corps ellipse + respiration sinusoïdale
- [ ] Yeux + pupilles (mouvement selon humeur)
- [ ] Bouche arc Bézier (souriant ↔ triste selon happiness)
- [ ] Oreilles ellipses latérales
- [ ] Interpolation couleur : `#7B2FBE` (heureux) → `#FF3333` (détresse)
- [ ] Animation saut (célébration)
- [ ] Animation tremblement (stress < 40)
- [ ] Animation larme (action en retard)
- [ ] `BlopStats.tsx` : 4 barres (énergie, équilibre, focus, bonheur)
- [ ] `BlopSpeech.tsx` : bulle de dialogue animée

> Voir [blop.md](blop.md) pour tous les détails.

---

## Étape 5 — Blop parle (MiniMax TTS) (17h → 20h)

### Objectif
Blop intervient vocalement dans le vocal Discord.

### Livrables
- [ ] Triggers détectés par eventService.ts (dominance >5min, retard, silence >2min)
- [ ] Templates de texte prêts (voir [blop.md](blop.md))
- [ ] MiniMax speech-2.8-turbo → buffer MP3
- [ ] Bot Discord joue l'audio via `createAudioPlayer`
- [ ] Broadcast WS `blop_speech` → bulle dialogue frontend
- [ ] Transcript enrichi avec interventions Blop (icône 🎙️)

### Jouer audio dans Discord
```typescript
import { createAudioPlayer, createAudioResource, StreamType, AudioPlayerStatus } from '@discordjs/voice'
import { Readable } from 'stream'

async function blopSpeak(connection: VoiceConnection, mp3Buffer: Buffer) {
  const player = createAudioPlayer()
  const resource = createAudioResource(Readable.from(mp3Buffer), { inputType: StreamType.Arbitrary })
  connection.subscribe(player)
  player.play(resource)
  await new Promise<void>(resolve => player.on(AudioPlayerStatus.Idle, () => resolve()))
}
```

---

## Étape 6 — UI complète + Compte-rendu + Discord (20h → 23h)

### Objectif
Expérience complète bout en bout, compte-rendu posté dans Discord.

### Livrables
- [ ] Layout 3 colonnes complet (SpeakerBars | Blop | Transcript)
- [ ] `Header.tsx` : timer, titre réunion, statut EN COURS / TERMINÉE
- [ ] `BottomBar.tsx` : indicateur d'écoute active, bouton Fin réunion
- [ ] Compte-rendu généré par MiniMax M2.7 → `MeetingSummary.tsx`
- [ ] Embed Discord posté dans le channel texte (EmbedBuilder)
- [ ] DM Discord individuel à chaque participant avec ses actions
- [ ] Dashboard historique (`Dashboard.tsx`)

---

## Étape 7 — Polish & Soumission (23h → 24h)

### Livrables
- [ ] README.md complet (setup, usage, architecture diagram ASCII)
- [ ] `.env.example` à jour
- [ ] Démo vidéo 3-5 min (scénario ci-dessous)
- [ ] Submission sur create.gosim.org/submit
- [ ] Pitch 2 min répété

### Script démo (3 min)
1. `/meetpet start` dans Discord → Blop rejoint le vocal
2. Conversation simulée → transcription en temps réel sur l'interface
3. Une personne monopolise 5 min → Blop intervient vocalement dans le canal
4. MiniMax détecte une action → apparaît dans la liste
5. `/meetpet stop` → compte-rendu posté dans Discord + DMs individuels
6. Montrer Blop heureux vs triste selon la qualité de la réunion

---

## Récapitulatif timing

| Étape | Durée | Criticité |
|---|---|---|
| 1. Scaffolding | 3h | 🔴 Bloquant |
| 2. Pipeline audio Discord + Groq STT | 5h | 🔴 Core |
| 3. Intelligence MiniMax M2.7 | 5h | 🔴 Core |
| 4. Blop Canvas | 4h | 🟠 Démo |
| 5. MiniMax TTS Blop | 3h | 🟠 Wow |
| 6. UI + Compte-rendu + Discord | 3h | 🟡 Complétude |
| 7. Polish & Submission | 1h | 🔴 Obligatoire |

## Risques

| Risque | Mitigation |
|---|---|
| `@discordjs/opus` compilation native | Tester étape 1, fallback `opusscript` |
| Groq Whisper rate limit | Buffer segments, retry 5s |
| MiniMax JSON malformé | Retry avec `temperature: 0` + prompt plus strict |
| MiniMax TTS endpoint inconnu | Fallback texte Discord, vérifier doc sur place |
| Canvas Blop trop long | Time-box 4h max, simple > beau |
