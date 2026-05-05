# Bugs & Issues — Suivi des tests

> Dernière mise à jour : 2026-05-05
> Format : [STATUT] Description — Cause — Fix appliqué

---

## Légende
- 🔴 Ouvert
- 🟡 En cours
- ✅ Corrigé

---

## BUG-001 — Cannot GET /summary/:id ✅
**Symptôme :** Après `/meetpet stop`, le navigateur redirige vers `localhost:3000/summary/...` et affiche "Cannot GET"
**Cause :** Deux problèmes cumulés :
1. `summaryUrl` dans `discordBot.ts` pointe vers le backend (port 3000) au lieu du frontend (port 5173)
2. La page `MeetingSummary.tsx` n'a jamais été créée, et le frontend n'a pas de routing

**Fix :** Ajouter `FRONTEND_URL` dans le `.env`, créer le routing frontend + `MeetingSummary.tsx`

---

## BUG-002 — Transcription ne s'affiche pas en temps réel 🟡
**Symptôme :** Section "Transcription en direct" reste sur "En attente de la parole..." même quand on parle
**Cause probable :** Pipeline audio Discord → Groq non déclenché. Pistes :
- Le bot n'était peut-être pas dans le canal vocal au moment du test
- Groq STT retourne une erreur silencieuse
- Les events `transcript` ne sont pas broadcastés

**Fix appliqué :**
- Correction du WAV envoyé à Groq : le PCM Discord décodé par `prism-media` est en 48 kHz, il était déclaré en 16 kHz dans l'en-tête WAV
- Seuil minimal audio ajusté pour éviter d'envoyer des fragments trop courts
- Les logs existants dans `discordBot.ts` permettent maintenant de voir : début parole, taille PCM, résultat Groq ou erreur STT

**À valider :** test réel dans un vocal Discord avec `GROQ_API_KEY` configurée

---

## BUG-003 — Blop ne parle pas 🟡
**Symptôme :** Aucune intervention vocale de Blop dans le canal Discord
**Cause probable :**
- Le trigger `dominance` ne se déclenche qu'après 5 min de parole continue → pas atteint en test rapide
- L'endpoint MiniMax TTS `/t2a_v2` est peut-être incorrect
- L'erreur TTS est catchée silencieusement (fallback texte seul)

**Fix appliqué :**
- La boucle rule-based déclenche maintenant `blopSpeak()` sur dominance et silence, au lieu de seulement broadcaster une alerte frontend
- Le seuil dominance reste à 30s en `NODE_ENV=development`
- Les alertes dominance/silence sont dédupliquées par prise de parole pour éviter le spam
- Le timer d'événements est maintenant stocké et stoppé à `/meetpet stop`
- Le fallback texte broadcast aussi l'intervention et l'ajoute au transcript même si le TTS échoue
- Le TTS utilise `MINIMAX_GROUP_ID` si présent et logue le statut + extrait de réponse si aucun audio n'est retourné

**À valider :** test réel MiniMax TTS avec `MINIMAX_API_KEY` configurée

---

## BUG-004 — Page compte-rendu inexistante ✅
**Symptôme :** Aucune page de compte-rendu accessible après la réunion
**Cause :** `MeetingSummary.tsx` pas encore créé (marqué "à faire" dans progress.md)
**Fix :** Créer la page + routing frontend

---

## BUG-005 — Crash process sur erreur MiniMax non catchée ✅
**Symptôme :** `node:events throw er — RateLimitError: 429 insufficient balance`
**Cause :** `handleStop` n'avait pas de try/catch autour de `generateSummary`
**Fix appliqué :** Try/catch dans `handleStop` + `process.on('unhandledRejection')` global — commit `39b7461`

---

## BUG-006 — Mauvaise clé API MiniMax ✅
**Symptôme :** 429 insufficient_balance même avec le plan Max actif
**Cause :** Utilisation de la clé "API Keys" standard au lieu de la clé "Token Plan Key"
**Fix appliqué :** Remplacement de `MINIMAX_API_KEY` par la Token Plan Key dans `.env`

---

## BUG-007 — Discord "L'application ne répond plus" ✅
**Symptôme :** Après `/meetpet start`, Discord affiche "L'application ne répond plus"
**Cause probable :** Le handler faisait des appels async (`guild.members.fetch`, Prisma, voice join) avant d'accuser réception auprès de Discord. Si cela dépasse environ 3 secondes, Discord marque l'interaction comme expirée.
**Fix appliqué :**
- `handleStart`, `handleStop`, `handleStatus` et `handleActions` appellent maintenant `deferReply()` dès l'entrée du handler
- `interactionCreate` est enveloppé dans un `try/catch`
- En cas d'erreur serveur, MeetPet répond à l'interaction et logue l'erreur dans le terminal backend

---

## BUG-008 — Frontend reste sur "En attente d'une réunion" ✅
**Symptôme :** Le bot démarre bien dans Discord, mais `localhost:5173` reste sur l'écran d'accueil.
**Cause :** Le frontend dépendait uniquement de l'événement WebSocket `meeting_started`. Si le frontend se connectait ou se rechargeait après `/meetpet start`, il ratait cet événement et ne pouvait pas reconstruire l'état en cours.
**Fix appliqué :**
- À chaque nouvelle connexion WebSocket, le backend envoie maintenant la réunion active si elle existe
- L'état synchronisé inclut `meeting_started`, `blop_update`, le speaker actif et le transcript déjà accumulé

---

## BUG-009 — Bot dans le vocal mais aucune transcription 🟡
**Symptôme :** La réunion est visible côté frontend, mais le temps de parole reste "En attente..." et aucune discussion n'est transcrite.
**Cause probable :** Le pipeline audio Discord n'était pas assez observable. Il fallait distinguer trois cas : connexion vocale pas encore prête, aucun event `speaking.start`, ou audio reçu mais STT Groq vide/erreur.

**Diagnostic courant :**
- Logs observés : `Voice signalling → connecting`, `Voice connecting → signalling`, puis `AbortError`
- Interprétation : Discord Voice ne passe pas en `Ready`, donc le bot peut apparaître dans le vocal mais l'audio n'est pas recevable
- Diagnostic local : `@discordjs/opus` ne chargeait pas car le binaire natif `opus.node` manquait sur macOS arm64
- Diagnostic voice : `@discordjs/voice@0.17.0` fermait le networking juste après `HELLO` (`code: 6 Closed`) avant l'UDP handshake

**Fix appliqué :**
- `/meetpet start` attend maintenant `VoiceConnectionStatus.Ready` avant de démarrer le pipeline audio
- Si la connexion vocale n'est pas prête après 30s, la connexion est détruite et aucune fausse réunion n'est créée
- Logs ajoutés sur les transitions de connexion vocale Discord
- Logs ajoutés sur `speaking.start`, `speaking.end`, erreurs de stream audio et erreurs du décodeur Opus
- Le frontend reçoit un événement "Audio prêt" quand le pipeline d'écoute est initialisé
- `npm rebuild @discordjs/opus` exécuté avec accès réseau/cache ; vérification OK : `sodium-native ok`, `@discordjs/opus ok`
- `@discordjs/voice` mis à jour en `0.18.0`, dernière version compatible Node 20 (`0.19.2` demande Node >= 22.12)
- `discord.js` mis à jour en `14.26.4` pour aligner le gateway adapter Discord avec la version voice

**À valider :**
- Vérifier que le bot a les permissions `View Channel`, `Connect` et `Speak` dans le salon vocal
- Relancer `/meetpet start` et confirmer que le backend affiche `Connexion vocale prête`
- Si le statut reste `signalling/connecting`, investiguer réseau/UDP Discord Voice ou dépendances natives `@discordjs/opus` / `sodium-native`

---

## Notes de test — Session 2026-05-05
- Premier test réussi : bot connecté, frontend affiché, Blop animé visible
- Timer EN COURS fonctionnel → WebSocket OK
- Transcription : non testée (bot peut-être pas dans vocal)
- Blop speech : non testée
- Summary : redirect vers mauvaise URL (BUG-001)

### 2026-05-05 — Reprise Codex
- BUG-002 : fix sample rate WAV Discord/Groq appliqué, validation réelle restante
- BUG-003 : triggers rule-based branchés sur la voix de Blop, validation réelle restante
- TTS MiniMax : logs d'erreur détaillés + support `MINIMAX_GROUP_ID`
- Persistance fin de réunion ajoutée : transcript, speakers, état Blop
- BUG-007 : accusé réception Discord immédiat sur les slash commands
- BUG-008 : synchronisation de la réunion active à la connexion WebSocket
- BUG-009 : attente connexion vocale Ready + logs audio Discord détaillés
