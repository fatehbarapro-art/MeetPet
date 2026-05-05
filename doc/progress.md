# Checklist d'avancement

> Dernière mise à jour : 2026-05-05
> **Cocher chaque tâche ici dès qu'elle est terminée.**
> Tout agent IA qui reprend le projet doit lire ce fichier en premier.

---

## État global

```
Étape 1 — Scaffolding        : 🔴 Non démarré
Étape 2 — Pipeline Audio     : 🔴 Non démarré
Étape 3 — Intelligence MiniMax: 🔴 Non démarré
Étape 4 — Blop Canvas        : 🔴 Non démarré
Étape 5 — TTS Blop           : 🔴 Non démarré
Étape 6 — UI + Discord CR    : 🔴 Non démarré
Étape 7 — Polish + Submit    : 🔴 Non démarré
```

---

## Étape 1 — Scaffolding & Infrastructure

- [ ] GitHub repo public créé
- [ ] LICENSE MIT ajoutée
- [ ] README.md de base
- [ ] `backend/` initialisé (npm init, tsconfig.json)
- [ ] Dépendances backend installées (express, ws, prisma, discord.js, @discordjs/voice, openai, dotenv...)
- [ ] `frontend/` créé via Vite
- [ ] Tailwind configuré dans le frontend
- [ ] Schéma Prisma écrit (`schema.prisma`)
- [ ] `npx prisma db push` passe sans erreur
- [ ] `.env.example` créé avec toutes les variables
- [ ] Serveur Express démarré sur port 3000 (`npm run dev`)
- [ ] WebSocket handler basique opérationnel
- [ ] Bot Discord connecté et visible en ligne dans le serveur
- [ ] Slash commands Discord enregistrées (dev guild)
- [ ] `utils/minimax.ts` initialisé (OpenAI SDK → baseURL minimax.io)
- [ ] `utils/groq.ts` initialisé (OpenAI SDK → baseURL groq.com)

---

## Étape 2 — Pipeline Audio Discord + Groq STT

- [ ] `/meetpet start` → bot rejoint le voice channel
- [ ] `AudioReceiveStream` par membre détecté (speaking.on('start'))
- [ ] Décodage Opus → PCM via `OpusDecoder`
- [ ] PCM → WAV → Groq Whisper STT → texte
- [ ] Transcription broadcastée via WebSocket
- [ ] `Transcript.tsx` affiche la transcription en temps réel
- [ ] `SpeakerBars.tsx` se met à jour quand un speaker parle
- [ ] `/meetpet stop` → bot quitte le vocal
- [ ] Speakers sauvegardés en SQLite à la fin

---

## Étape 3 — Intelligence MiniMax M2.7-highspeed

- [ ] Buffer de transcription 30s opérationnel
- [ ] Appel MiniMax M2.7-highspeed toutes les 30s avec le buffer
- [ ] JSON parsé et validé (try/catch + retry si malformé)
- [ ] Actions persistées en SQLite
- [ ] Temps de parole calculé et persisté par speaker
- [ ] Score Blop calculé (formule complète — voir blop.md)
- [ ] `blop_update` broadcasté après chaque analyse
- [ ] `action_detected` broadcasté pour chaque nouvelle action
- [ ] `dominance_alert` broadcasté si un speaker > 5 min
- [ ] Rule-based micro-events : new_speaker, silence, dominance (eventService.ts)
- [ ] `ActionsList.tsx` affiche les actions avec statut

---

## Étape 4 — Blop Canvas

- [ ] `BlopCanvas.tsx` avec boucle 60fps (`requestAnimationFrame`)
- [ ] Corps ellipse + respiration sinusoïdale
- [ ] Yeux + pupilles
- [ ] Bouche arc Bézier (souriant ↔ triste)
- [ ] Oreilles
- [ ] Interpolation couleur selon mood
- [ ] Animation saut (célébration)
- [ ] Animation tremblement (stress)
- [ ] Animation larme (action en retard)
- [ ] `BlopStats.tsx` avec 4 barres (énergie, équilibre, focus, bonheur)
- [ ] `BlopSpeech.tsx` bulle de dialogue animée

---

## Étape 5 — TTS Blop (MiniMax speech-2.8-turbo)

- [ ] Triggers d'intervention implémentés (monopolisation, retard, silence)
- [ ] Templates de texte Blop prêts
- [ ] MiniMax speech-2.8-turbo appelé → buffer MP3
- [ ] Audio MP3 joué dans le vocal Discord via `createAudioPlayer`
- [ ] `blop_speech` broadcasté → bulle affichée dans le frontend
- [ ] Transcript enrichi avec interventions Blop (icône 🎙️)

---

## Étape 6 — UI complète + Compte-rendu + Discord

- [ ] Layout 3 colonnes complet (SpeakerBars | Blop | Transcript)
- [ ] `Header.tsx` avec timer et statut EN COURS / TERMINÉE
- [ ] `BottomBar.tsx` avec indicateur d'écoute et bouton Fin
- [ ] Compte-rendu généré par MiniMax M2.7 en fin de réunion
- [ ] `MeetingSummary.tsx` page compte-rendu
- [ ] Embed Discord posté dans le channel texte
- [ ] DMs Discord individuels envoyés à chaque participant
- [ ] Dashboard historique (`Dashboard.tsx`)

---

## Étape 7 — Polish & Soumission

- [ ] README.md complet (setup, usage, architecture)
- [ ] `.env.example` à jour
- [ ] Démo vidéo 3-5 min enregistrée
- [ ] Soumission sur create.gosim.org/submit
- [ ] Pitch 2 min répété

---

## Notes de session

### 2026-05-05
- Architecture définie : Discord vocal + Groq Whisper STT + MiniMax M2.7 analyse + MiniMax TTS
- Décisions :
  - Discord remplace browser mic + Slack/Teams (diarisation native)
  - Kimi éliminé (sponsor = MiniMax, pas Kimi)
  - DeepSeek éliminé (RouteTokens non nécessaire)
  - Groq Whisper remplace MiniMax STT (non documenté dans la doc MiniMax)
  - Micro-events = rule-based local (0 API, 0 latence)
- Documentation complète créée dans `doc/`
- Prochaine action : démarrer l'étape 1 (scaffolding)
