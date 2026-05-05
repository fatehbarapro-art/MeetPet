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

## BUG-002 — Transcription ne s'affiche pas en temps réel 🔴
**Symptôme :** Section "Transcription en direct" reste sur "En attente de la parole..." même quand on parle
**Cause probable :** Pipeline audio Discord → Groq non déclenché. Pistes :
- Le bot n'était peut-être pas dans le canal vocal au moment du test
- Groq STT retourne une erreur silencieuse
- Les events `transcript` ne sont pas broadcastés

**Fix :** Ajouter des logs dans `audioService` + vérifier que le bot est bien dans le vocal avant de parler

---

## BUG-003 — Blop ne parle pas 🔴
**Symptôme :** Aucune intervention vocale de Blop dans le canal Discord
**Cause probable :**
- Le trigger `dominance` ne se déclenche qu'après 5 min de parole continue → pas atteint en test rapide
- L'endpoint MiniMax TTS `/t2a_v2` est peut-être incorrect
- L'erreur TTS est catchée silencieusement (fallback texte seul)

**Fix :** Vérifier l'endpoint TTS MiniMax + baisser le seuil de dominance à 30s pour les tests

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

## Notes de test — Session 2026-05-05
- Premier test réussi : bot connecté, frontend affiché, Blop animé visible
- Timer EN COURS fonctionnel → WebSocket OK
- Transcription : non testée (bot peut-être pas dans vocal)
- Blop speech : non testée
- Summary : redirect vers mauvaise URL (BUG-001)
