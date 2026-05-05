# Checklist d'avancement

> Dernière mise à jour : 2026-05-05
> **Cocher chaque tâche ici dès qu'elle est terminée.**
> Tout agent IA qui reprend le projet doit lire ce fichier en premier.

---

## État global

```
Étape 1 — Scaffolding         : ✅ Terminé
Étape 2 — Pipeline Audio      : ✅ Terminé
Étape 3 — Intelligence MiniMax: ✅ Terminé
Étape 4 — Blop Canvas         : ✅ Terminé
Étape 5 — TTS Blop            : ✅ Terminé
Étape 6 — UI + Discord CR     : 🟡 Partiel
Étape 7 — Polish + Submit     : 🔴 Non démarré
```

---

## Étape 1 — Scaffolding & Infrastructure

- [x] `backend/` initialisé — `package.json`, `tsconfig.json`
- [x] Dépendances backend installées — `express`, `ws`, `prisma`, `discord.js`, `@discordjs/voice`, `openai`, `dotenv`, `prism-media`
- [x] `frontend/` initialisé — Vite + React + TypeScript
- [x] Tailwind v4 configuré (`@tailwindcss/vite`)
- [x] Schéma Prisma écrit — `Team`, `Meeting`, `Speaker`, `Action`, `BlopState`
- [x] `npx prisma db push` — SQLite `dev.db` créé et synchronisé
- [x] `npx prisma generate` — client Prisma généré
- [x] `.env.example` créé avec toutes les variables
- [x] `backend/.env` créé (clés à remplir)
- [x] Serveur Express + WebSocket — `server.ts` avec `broadcast()` exportée
- [x] Routes REST — `GET /api/health`, `GET /api/meetings`, `GET /api/meetings/:id`, `PATCH /api/actions/:id`
- [x] `utils/minimax.ts` — client OpenAI SDK → `api.minimax.io/v1`
- [x] `utils/groq.ts` — client OpenAI SDK → `api.groq.com/openai/v1`
- [x] TypeScript backend — `npx tsc --noEmit` ✅ 0 erreur
- [x] TypeScript frontend — `npx tsc --noEmit` ✅ 0 erreur
- [ ] GitHub repo public — à pousser (auth SSH en attente)
- [ ] LICENSE MIT — à ajouter
- [ ] Bot Discord connecté en ligne — clés `.env` à remplir
- [ ] Slash commands Discord enregistrées — clés `.env` à remplir

---

## Étape 2 — Pipeline Audio Discord + Groq STT

- [x] `discordBot.ts` — `/meetpet start` : bot rejoint le voice channel via `joinVoiceChannel`
- [x] `AudioReceiveStream` par membre — `receiver.speaking.on('start', userId)`
- [x] Décodage Opus → PCM — `prism.opus.Decoder({ frameSize: 960, channels: 1, rate: 48000 })`
- [x] `pcmToWav()` — wrapping PCM en WAV 16kHz pour Groq
- [x] `transcribeAudio()` — Groq Whisper `whisper-large-v3`, langue `fr`
- [x] Transcription broadcastée — `broadcast({ type: 'transcript', ... })`
- [x] `Transcript.tsx` — affiche les segments en temps réel, auto-scroll
- [x] `SpeakerBars.tsx` — barres de temps de parole par speaker
- [x] `/meetpet stop` — `getVoiceConnection(guildId)?.destroy()`
- [x] `onSpeakerStart/End` — tracking secondes de parole par userId
- [ ] Speakers persistés en SQLite à la fin — à implémenter dans `handleStop`

---

## Étape 3 — Intelligence MiniMax M2.7-highspeed

- [x] `analyzeTranscript()` — appel MiniMax M2.7-highspeed, `response_format: json_object`, retry si malformé
- [x] `runAnalysis()` — appelée toutes les 30s via `setInterval`
- [x] JSON parsé — actions, speakingTime, dominanceAlert, blopMood
- [x] Actions persistées en SQLite — `prisma.action.create()` si confidence ≥ 0.7
- [x] `action_detected` broadcasté pour chaque nouvelle action
- [x] `blop_update` broadcasté après chaque analyse
- [x] `dominance_alert` broadcasté si un speaker dépasse le seuil
- [x] `computeBlopState()` — formule complète (équilibre 40%, actions 30%, durée 15%, clarté 15%)
- [x] `blopService.ts` — `moodFromScore()`, `defaultBlopState()`, `blopInterventionText()`
- [x] `eventService.ts` — rule-based : `new_speaker` (+5 bonheur), `dominance` (check 15s), `silence` (-5)
- [x] `ActionsList.tsx` — liste des actions avec icône statut (⏳/✅/🔴)

---

## Étape 4 — Blop Canvas

- [x] `BlopCanvas.tsx` — boucle 60fps `requestAnimationFrame`
- [x] Corps ellipse avec respiration sinusoïdale (bodyW/H oscillant)
- [x] Yeux avec pupilles et blink aléatoire
- [x] Mouvement yeux subtil selon le temps
- [x] Bouche arc `quadraticCurveTo` — souriant si happiness > 50, triste si < 50
- [x] Oreilles ellipses latérales
- [x] Interpolation couleur RGB progressive entre moods (`lerpColor`)
- [x] Animation saut — déclenché si happiness > 80 ou mood `euphoric`
- [x] Animation tremblement — déclenché si happiness < 40
- [x] Larme animée (tombe) si happiness < 40
- [x] `BlopStats.tsx` — 4 barres (énergie/équilibre/focus/bonheur) avec couleurs distinctes
- [x] `BlopSpeech.tsx` — bulle de dialogue avec flèche, animation bounce

---

## Étape 5 — TTS Blop (MiniMax speech-2.8-turbo)

- [x] `synthesizeSpeech()` — appel `api.minimax.io/v1/t2a_v2`, retourne buffer MP3
- [x] `blopSpeak()` — `createAudioPlayer` + `createAudioResource` → joué dans le vocal Discord
- [x] Fallback si TTS échoue — broadcast texte uniquement, pas de crash
- [x] `blop_speech` broadcasté — bulle dialogue frontend affichée 5s
- [x] Trigger dominance — intervention si speaker > 5 min consécutives
- [x] `blopInterventionText()` — templates : dominance, silence, overdue, celebration, end_fast
- [x] Interventions Blop ajoutées au transcript — `{ speaker: '🎙️ Blop', ... }`

---

## Étape 6 — UI complète + Compte-rendu + Discord

- [x] Layout 3 colonnes — `MeetingRoom.tsx` (SpeakerBars | Blop | Transcript)
- [x] `Header.tsx` — timer en temps réel, indicateur EN COURS (pulse rouge)
- [x] `BottomBar.tsx` — speaker actif avec indicateur vert, instruction `/meetpet stop`
- [x] `App.tsx` — écran d'accueil si pas de réunion, bascule sur `MeetingRoom` à la connexion
- [x] `store.ts` — Zustand : état global meetingId, transcript, actions, blopState, blopSpeech
- [x] `useWebSocket.ts` — routing complet de tous les events WS
- [x] `generateSummary()` — compte-rendu Markdown via MiniMax M2.7 en fin de réunion
- [x] `buildSummaryEmbed()` — Embed Discord coloré selon mood Blop
- [x] Embed posté dans le channel texte Discord à la fin
- [ ] `MeetingSummary.tsx` — page web compte-rendu (route `/summary/:id`) — **à faire**
- [ ] DMs Discord individuels par participant — **à faire**
- [ ] `Dashboard.tsx` — historique des réunions — **à faire**
- [ ] Speakers persistés en SQLite dans `handleStop` — **à faire**

---

## Étape 7 — Polish & Soumission

- [ ] README.md complet (setup, usage, architecture)
- [ ] LICENSE MIT
- [ ] `.env.example` à jour — ✅ déjà fait
- [ ] Démo vidéo 3-5 min
- [ ] Soumission sur create.gosim.org/submit
- [ ] Pitch 2 min répété

---

## Notes de session

### 2026-05-05 — Session 1 : Architecture & docs
- Stack définie : Discord + Groq Whisper STT + MiniMax M2.7 + MiniMax TTS
- Kimi et DeepSeek éliminés (sponsor = MiniMax uniquement)
- Micro-events = rule-based (0 API)
- Documentation complète créée dans `doc/`

### 2026-05-05 — Session 2 : Scaffolding + code complet
- Backend complet : server, discordBot, services, utils — 0 erreur TS
- Frontend complet : App, MeetingRoom, Blop animé, store, WS — 0 erreur TS
- Prisma DB synchronisée
- **Clés à remplir dans `backend/.env` avant de tester :**
  - `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`
  - `MINIMAX_API_KEY`, `MINIMAX_GROUP_ID`
  - `GROQ_API_KEY`
- **Reste à coder :** `MeetingSummary.tsx`, `Dashboard.tsx`, DMs Discord, speakers SQLite
