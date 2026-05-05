# Voice listening/speaking — investigation findings

> Date : 2026-05-05
> Branche : `voice-investigation` (worktree `.worktrees/voice-investigation`)
> Symptôme : `/meetpet start` rejoint le canal vocal mais Blop n'écoute pas et ne parle pas.

---

## Résumé exécutif

Les deux hypothèses initiales les plus probables (sodium-native v4 incompatible, ffmpeg manquant) **sont écartées** par les tests en conteneur :

- `sodium-native@4.3.3` expose bien `crypto_aead_xchacha20poly1305_ietf_encrypt/decrypt` et le round-trip fonctionne. **H1 écartée.**
- `@discordjs/voice@0.18.0` préfère le mode `aead_aes256_gcm_rtpsize` quand Node fournit `aes-256-gcm` (toujours, depuis Node 12). Ce chemin **n'utilise pas du tout sodium-native** — Node natif (`crypto.createCipheriv`) suffit.
- L'hôte dispose de `ffmpeg 8.1.1` (Homebrew). **H2 écartée pour le speak.**
- `@discordjs/opus@0.9.0` se compile et se charge en Node 22 / arm64 dans le conteneur (pas de prebuild ABI 127, build from source OK).

Le stack natif est donc fonctionnel. Le bug est ailleurs : soit (a) la connexion Voice atteint Ready mais aucun paquet UDP RTP n'est reçu ; soit (b) les paquets arrivent mais l'événement `Speaking` du voice gateway ne mappe pas `ssrc → userId` ; soit (c) l'`AudioPlayer` côté speak échoue silencieusement (ffmpeg/prism-media child crashe).

Pour trancher, on **instrumente** le bot avec des compteurs de paquets UDP, un log RTP brut avant Opus, des listeners d'erreur sur `AudioPlayer`, et un endpoint HTTP de test pour déclencher `blopSpeak` à la demande. La prochaine session de test produit les preuves nécessaires.

---

## Preuves collectées

### Versions installées (conteneur Linux/amd64 + Linux/arm64)

```
Core Dependencies
- @discordjs/voice: 0.18.0
- prism-media: 1.3.5

Opus Libraries
- @discordjs/opus: 0.9.0

Encryption Libraries
- sodium-native: 4.3.3

FFmpeg
- version: 5.1.8-0+deb12u1
- libopus: yes
```

(cf. `01-baseline-amd64.log`, `05-node22-arm64.log`)

### Test cryptographique direct

```
encrypted bytes: 35 first16: 009d5e6e4014d1e32ed07fe7659d24a7
decrypted: hello discord voice
match: true
```

`sodium-native@4.3.3` fonctionne pour le round-trip AEAD XChaCha20-Poly1305-IETF (cf. `02-encryption-test.log`).

### Lecture du code @discordjs/voice 0.18 (dist/index.js)

1. **Modes supportés** :
   ```js
   var SUPPORTED_ENCRYPTION_MODES = ["aead_xchacha20_poly1305_rtpsize"];
   if (crypto.getCiphers().includes("aes-256-gcm")) {
     SUPPORTED_ENCRYPTION_MODES.unshift("aead_aes256_gcm_rtpsize");
   }
   ```
   → on choisit toujours `aead_aes256_gcm_rtpsize` en priorité, qui passe par Node natif.

2. **Réception RTP** : `VoiceReceiver.onUdpMessage(msg)` lit le SSRC à l'offset 8, appelle `ssrcMap.get(ssrc)`. **Si pas de mapping, le paquet est dropped silencieusement.**

3. **Mapping SSRC → userId** alimenté par le voice gateway WS via :
   - op `Speaking` (op code 5) : `ssrcMap.update({ userId, audioSSRC })`
   - op `ClientConnect` : pareil
   - op `ClientDisconnect` : `ssrcMap.delete(userId)`

4. **`speaking.start`** émis par `speaking.onPacket(userId)` UNIQUEMENT si l'utilisateur est mappé dans le ssrcMap au moment où un paquet arrive. **Sans mapping → aucun event, aucun bug, juste silence.**

(cf. `04-receiver-flow.log`)

### Hôte

```
Node v22.13.1 / npm 10.9.2 / ffmpeg 8.1.1 (Homebrew)
backend/node_modules : ABSENT  ← le projet n'est plus installé localement
```

Le `node_modules` du projet sur l'hôte est absent. L'utilisateur a probablement reset l'env après les fixes de BUG-009 (commits b799566 / f7ee51b). Il faudra réinstaller (commande dans la section *handoff*).

---

## Hypothèses restantes (à valider au prochain run)

| # | Hypothèse | Preuve qui la confirmerait |
|---|---|---|
| **A** | UDP RTP n'arrive jamais (NAT, IPv6, MTU, firewall) | compteur UDP packets = 0 alors que voice = Ready |
| **B** | UDP arrive mais SSRC pas dans la map (op Speaking jamais reçu sur WS) | log `[UDP] received N bytes ssrc=X` mais aucun `[GW] Speaking user_id=Y ssrc=X` |
| **C** | `prism.opus.Decoder({channels: 1})` ne supporte pas le stéréo Discord → décode silencieusement vers du PCM corrompu ou nul | byte count Opus arrive mais `decoder.on('error')` fire, ou PCM length ≠ ce qu'on attend |
| **D** | `AudioPlayer` reste en `Buffering` ou passe en `error` (ffmpeg child crash, MP3 invalide) | `player.on('stateChange')` montre AutoPaused/Idle sans Playing, ou `player.on('error')` fire |
| **E** | Bot serveur-deafened ou perm Speak manquante | preflight log déjà en place le montrera |
| **F** | Fast loop ferme la connexion WS après HELLO (réminiscence BUG-009 sur 0.17 → 0.18) | `Voice signalling → connecting → signalling` en boucle |

---

## Fix proposé (séquence)

### Étape 1 — Instrumentation (cette branche)

Modifications dans `backend/src/integrations/discord/discordBot.ts` :

1. **Au démarrage du bot** : log `generateDependencyReport()` pour confirmer ce que voit la prod.
2. **Sur `client.on('debug')`** : déjà OK pour discord.js. Ajouter un debug listener sur la voice connection qui filtre les lignes `[UDP]` et incrémente un compteur (logué toutes les 10s).
3. **Sur `connection.on('debug')`** : déjà filtré pour redacter les secrets — ajouter parsing des lignes `[WS] >> {"op":5...}` pour logger `Speaking ssrc=X user=Y`.
4. **Dans `startAudioPipeline`** :
   - Logger taille du premier paquet RTP brut reçu sur `stream` (avant pipe vers décodeur).
   - Décoder l'Opus en `channels: 2` (Discord encode toujours en stéréo) puis downmix mono avant Groq.
   - Logger erreurs détaillées du décodeur Opus.
5. **Dans `blopSpeak`** :
   - Ajouter `player.on('stateChange', (o,n) => log)` et `player.on('error', log)`.
   - Logger les 4 premiers octets du buffer MP3 (vérifier signature `ID3` ou `\xFF\xFB`).
   - Ajouter `entersState(player, AudioPlayerStatus.Playing, 5_000)` avec log d'erreur si Playing n'arrive jamais.
6. **Endpoint dev HTTP** : `POST /api/dev/blop-say` body `{text}` qui déclenche `blopSpeak` directement, sans attendre l'analyse MiniMax. Permet à l'utilisateur de tester le speak en isolation.

### Étape 2 — Mesures à prendre selon les logs

- Si **A** confirmée : fixer à `0.0.0.0` ou désactiver IPv6, ouvrir UDP entrant, tester depuis une autre région.
- Si **B** confirmée : essayer `@discordjs/voice@0.19.x` + Node 22.12 (gateway v8) ou ajouter `clientConnect`/Speaking simulation.
- Si **C** confirmée : `channels: 2` + downmix (déjà appliqué dans l'instrumentation).
- Si **D** confirmée : remplacer MiniMax MP3 par un fichier WAV/PCM préconverti dans le code (ou pipe via prism-media FFmpeg explicite avec stderr capturé).
- Si **E** confirmée : corriger les permissions / undeafen côté serveur.
- Si **F** confirmée : escalader vers un upgrade de version voice.

### Étape 3 — Validation

Critères (cf. plan initial Phase 5) :
- `🎙️ X commence à parler` apparaît quand un humain parle.
- `🔊 X — Ns de son (>0 bytes PCM)` avec ~96000 bytes/s (mono 48k 16bit).
- `📝 Groq STT → "..."` non vide.
- `blopSpeak` → `AudioPlayerStatus.Playing` puis `Idle`, audible par un autre participant.

---

## Sources documentaires

- Voice connection encryption modes (Discord docs) : `xsalsa20_*` retirés depuis 2024-11-18, modes requis `aead_xchacha20_poly1305_rtpsize` (required), `aead_aes256_gcm_rtpsize` (preferred).
- @discordjs/voice CHANGELOG : 0.18.0 a retiré `tweetnacl`, ajouté l'AEAD ; 0.19.x exige Node 22.12 + DAVE.
- Issue communautaires sodium-native v4 / @discordjs/voice : confirmé que la confusion vient du README (^3.3.0) mais l'API AEAD est bien identique en v4 — fonctionne.
