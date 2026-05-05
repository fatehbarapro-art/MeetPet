# Reproduce the voice fix on another machine

> Ce document décrit le strict nécessaire pour reproduire l'état **vérifié comme fonctionnel** :
> - 🎤 Discord → Opus → PCM → Groq Whisper (FR) — transcription confirmée en live
> - 🔊 Texte → MiniMax TTS → MP3 → ffmpeg → Discord — audible en live
> - 🤖 MiniMax-M2 chat (analyse / résumé) — utilise le bon modèle

---

## Pré-requis

- **Node 22.12+** (les binaires natifs sont compilés à l'install — Xcode CLT / build-essential présents)
- **ffmpeg** sur le PATH
- Token Discord d'un bot avec intents `Guilds + GuildVoiceStates + GuildMessages` et permissions `Connect / Speak / Use Voice Activity` dans le canal vocal
- Clé Groq (`gsk_...`)
- Clé MiniMax type "Token Plan Key" (la clé doit déjà inclure le groupe — **ne pas** envoyer `GroupId` séparément)

---

## Dépendances backend (versions exactes vérifiées)

```
@discordjs/voice    0.19.2
@discordjs/opus     0.10.0
@snazzah/davey      0.1.11   ← requis pour le voice gateway v8 (DAVE)
sodium-native       4.3.3
prism-media         1.3.5
discord.js          14.26.4
ffmpeg              8.x      ← libopus, sur le PATH
```

`generateDependencyReport()` doit afficher au démarrage :
```
- @discordjs/voice: 0.19.2
- @discordjs/opus: 0.10.0
- DAVE Libraries → @snazzah/davey: 0.1.11
- Encryption → native crypto support for aes-256-gcm: yes
- FFmpeg version + libopus: yes
```

---

## .env minimal

```
NODE_ENV=development
PORT=3000
DATABASE_URL="file:./dev.db"

DISCORD_BOT_TOKEN=...
DISCORD_CLIENT_ID=...
DISCORD_GUILD_ID=...

GROQ_API_KEY=gsk_...

MINIMAX_API_KEY=sk-cp-...
# Optionnel — par défaut English_Aussie_Bloke (testé OK sur le compte hackathon)
MINIMAX_VOICE_ID=

# Frontend
FRONTEND_URL=http://localhost:5173
```

> **⚠️** Ne PAS configurer `MINIMAX_GROUP_ID` même si tu l'as. La clé "Token Plan Key" porte déjà le groupe — ajouter le param `GroupId` à la requête déclenche `1004 token not match group`.

---

## Install + run

```bash
cd backend
npm install                       # compile @discordjs/opus en natif
npx prisma generate
npx prisma db push                # crée dev.db
npm run dev
```

Sur Discord :
```
/meetpet start                    # bot rejoint le canal vocal
# … parler, voix transcrite vers Groq Whisper FR
/meetpet stop                     # résumé MiniMax-M2 + embed Discord
```

---

## Ce qui était cassé et la cause exacte

| Symptôme | Cause | Fix |
|---|---|---|
| Bot rejoint le vocal mais n'entend ni ne parle | `@discordjs/voice 0.18` parle gateway v4, **Discord exige v8 + DAVE depuis fin 2024** — le WS se ferme juste après HELLO | upgrade `@discordjs/voice@0.19.2` + `@snazzah/davey` |
| Crash silencieux du process Node après le 1er paquet Opus | `@discordjs/opus 0.9.0` segfault sur certains paquets SILK (TOC `0x78`) avec Node 22 ABI 127 | upgrade `@discordjs/opus@0.10.0` |
| PCM décodé incohérent / vide | Décodeur configuré en mono alors que Discord encode en stéréo | `prism.opus.Decoder({ channels: 2 })` + downmix mono avant Whisper |
| MiniMax TTS `1004 token not match group` | Code passait `?GroupId=...` en query — incompatible avec les Token Plan Keys | retirer le param `GroupId` |
| MiniMax chat `2061 token plan not support model` | Modèle `MiniMax-M2.7-highspeed` non dispo sur le plan utilisé | passer à `MiniMax-M2` |
| MiniMax-M2 → JSON invalide | M2 émet un bloc `<think>...</think>` avant le JSON | strip via regex avant `JSON.parse` |
| MiniMax TTS `2054 voice id not exist` | `female-youthful` non dispo sur ce compte | utiliser un voice id existant — par défaut `English_Aussie_Bloke`, configurable via `MINIMAX_VOICE_ID` |

---

## Vérification end-to-end (golden path)

Logs attendus pour 1 cycle complet :

```
✅ Discord bot connecté : <bot>#xxxx
--- @discordjs/voice generateDependencyReport ---
- @discordjs/voice: 0.19.2
- @discordjs/opus: 0.10.0
- @snazzah/davey: 0.1.11
- FFmpeg version: 8.x | libopus: yes
---

[voice:*] 🧭 Preflight { joinable:true, speakable:true, botPermissions:{connect:true,speak:true,...} }
[voice:*] 🔎 [NW] [WS] << {"op":8,"d":{"v":8,...}}      ← gateway v8
[voice:*] 🔎 [NW] [DAVE] Session initialized for protocol version 1
[voice:*] 🔌 Voice connecting → ready
[voice:*] ✅ Connexion vocale prête
[voice:*] 👂 Pipeline audio prêt

[voice:*] 🎙️ <user> commence à parler
[voice:*] 📦 Premier paquet Opus <user> : NB head=78...
[voice:*] 🔉 Premier PCM décodé <user> : 3840B (stéréo 48k)
[voice:*] 🔊 <user> — Ns opus=NB stéréo=NB mono=NB
[voice:*] 📝 Groq STT → "..."

[blopSpeak] 🗣️ trigger=...
[blopSpeak] 🎵 audio=NB magic=mp3-id3
[blopSpeak] 🎚️ player idle → buffering → playing
[blopSpeak] ▶️ Playing
[blopSpeak] ⏹️ Idle (lecture terminée)
```

Endpoint dev (NODE_ENV=development) pour tester le speak sans attendre la boucle d'analyse :

```bash
curl -X POST http://localhost:3000/api/dev/blop-say \
  -H 'Content-Type: application/json' \
  -d '{"text":"Salut, test du pipeline vocal."}'
```
