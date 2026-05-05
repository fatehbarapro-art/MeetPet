# MeetPet — Documentation IA

> Point d'entrée unique pour tout agent IA (Claude, Codex, Gemini, etc.) reprenant le projet.
> **Mettre ce fichier à jour à chaque session de travail.**

---

## Qu'est-ce que MeetPet ?

Agent vocal de réunion avec mascotte vivante **Blop**. Le bot rejoint un **vocal Discord**, transcrit les échanges en temps réel, détecte les actions, et Blop intervient vocalement pour recadrer ou féliciter l'équipe.

**Pitch en une phrase :** "Blop écoute ta réunion Discord, engueule celui qui monopolise la parole, et envoie le compte-rendu à la fin."

---

## État du projet

| Champ | Valeur |
|---|---|
| **Statut** | 🔴 Non démarré |
| **Contexte** | Hackathon GOSIM Paris 2026 — 24h |
| **Sponsor sélectionné** | MiniMax (Minimax Excellence Award $2000) |
| **Repo GitHub** | À créer |
| **Dernière session** | 2026-05-05 — Stack finalisée, docs complètes |
| **Prochaine étape** | Étape 1 : Scaffolding |

---

## Navigation rapide

| Fichier | Contenu |
|---|---|
| [plan.md](plan.md) | Plan de développement complet par étapes (24h) |
| [architecture.md](architecture.md) | Stack technique, structure fichiers, dépendances |
| [discord.md](discord.md) | Intégration Discord — audio, bot, commandes |
| [blop.md](blop.md) | Logique Blop — états, animations, interventions |
| [api.md](api.md) | APIs IA — endpoints, auth, exemples de code |
| [database.md](database.md) | Schéma Prisma complet |
| [websocket.md](websocket.md) | Protocole WebSocket (events backend ↔ frontend) |
| [progress.md](progress.md) | ✅ Checklist d'avancement à cocher |

---

## Stack finale (hackathon simplifié)

```
Discord Voice Channel
       │ @discordjs/voice (OpusDecoder → PCM par speaker)
       ▼
Backend Node.js (Express + WebSocket)
       │
       ├─ Groq Whisper (STT gratuit, OpenAI-compat) → transcription temps réel
       ├─ MiniMax M2.7-highspeed → analyse toutes les 30s (actions, mood Blop, compte-rendu)
       ├─ Rule-based logic → micro-events (nouveau speaker, monopolisation, silence)
       └─ MiniMax speech-2.8-turbo (TTS) → Blop parle dans le vocal Discord
       │
       ├─ SQLite/Prisma → persistance
       └─ WebSocket → Frontend React (Blop animé Canvas, dashboard)
```

**Clés API requises :**
- `MINIMAX_API_KEY` — text M2.7-highspeed + TTS speech-2.8-turbo
- `GROQ_API_KEY` — Whisper STT (gratuit sur groq.com)
- `DISCORD_BOT_TOKEN` — bot vocal

---

## Règles pour tout agent IA qui reprend ce projet

1. **Lire [progress.md](progress.md) en premier** pour savoir où on en est
2. **Ne pas refaire ce qui est coché** — vérifier les fichiers existants avant
3. **Mettre à jour progress.md** après chaque tâche terminée
4. **Mettre à jour README.md** (section État du projet + Dernière session)
5. Les API keys sont dans `.env` (jamais dans le code) — voir [api.md](api.md) pour la structure
6. Si un sous-doc devient > 300 lignes, le découper en sous-fichiers thématiques
7. **Pas de DeepSeek, pas de RouteTokens** — stack = MiniMax + Groq uniquement
