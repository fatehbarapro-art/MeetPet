# Blop — Mascotte vivante

> Dernière mise à jour : 2026-05-05

---

## États émotionnels

| Score happiness | État | Couleur | Comportement vocal |
|---|---|---|---|
| 80-100 | Euphorique | `#7B2FBE` (violet) | Célèbre, encourage, fait des blagues |
| 60-79 | Content | `#5B8DEF` (bleu) | Neutre, notes positives |
| 40-59 | Stressé | `#FF8C00` (orange) | Interventions douces de recadrage |
| 20-39 | Triste | `#FF4444` (rouge clair) | Interventions urgentes, signale les problèmes |
| 0-19 | En détresse | `#FF3333` (rouge) | Alerte forte, demande une pause |

---

## Formule de calcul du score

```typescript
function computeHappiness(state: MeetingState): number {
  const balanceScore = computeBalanceScore(state.speakingTime)
  const actionsScore = Math.max(0, 100 - state.overdueActions * 10)
  const durationScore = state.durationMin <= 60 
    ? 100 
    : Math.max(0, 100 - (state.durationMin - 60) * 2)
  const clarityScore = state.actionsDetected > 0 ? 100 : 50

  return Math.round(
    balanceScore * 0.40 +
    actionsScore * 0.30 +
    durationScore * 0.15 +
    clarityScore * 0.15
  )
}

function computeBalanceScore(speakingTime: Record<string, number>): number {
  const values = Object.values(speakingTime)
  if (values.length <= 1) return 100
  const avg = 1 / values.length
  const maxDeviation = Math.max(...values.map(v => Math.abs(v - avg)))
  const deviationPercent = maxDeviation / avg * 100
  return Math.max(0, 100 - Math.max(0, deviationPercent - 15) * 2)
}
```

---

## Métriques qui influencent Blop

| Métrique | Poids | Détail |
|---|---|---|
| Équilibre temps de parole | 40% | Idéal = chaque participant ±15% de la moyenne |
| Actions non réalisées | 30% | -10 bonheur par action en retard |
| Durée de la réunion | 15% | Au-delà de 60 min → fatigue (-2/min) |
| Clarté des décisions | 15% | Réunion sans actions claires → confusion |

---

## Triggers d'intervention vocale

| Déclencheur | Condition | Script |
|---|---|---|
| Monopolisation | Un speaker > 5 min consécutives | "Hey, {prénom} parle depuis {N} minutes. {Autre}, t'as un avis ?" |
| Action en retard | Action overdue détectée en début de réunion | "Les {chose} de {prénom} sont en retard depuis {date}... je suis un peu triste 😢" |
| Silence | Aucun speaker depuis > 2 min | "Vous êtes encore là ? Le silence me stresse un peu." |
| Bonne réunion | happiness > 80 en fin de réunion | "Super réunion ! Tout le monde a parlé, {X} actions claires. Je suis heureux !" |
| Fin rapide | Réunion terminée < 45 min | "On a fini en {N} minutes avec {X} actions. Je prends ça !" |
| Nouveau speaker | Un participant silencieux prend la parole | "+5 bonheur ! {prénom} vient de s'exprimer 🎉" (dans le channel texte) |

---

## Animation Canvas

### Structure du personnage

```typescript
interface BlopState {
  x: number        // centre
  y: number        // centre
  bodyW: number    // largeur ellipse (base: 120px)
  bodyH: number    // hauteur ellipse (base: 140px)
  color: string    // interpolée selon happiness
  mood: 'euphoric' | 'happy' | 'stressed' | 'sad' | 'distressed'
  // Paramètres animation
  breathPhase: number    // 0-2π, sinusoïde respiration
  jumpOffset: number     // translateY pour le saut
  shakeOffset: number    // translateX pour le tremblement
}
```

### Boucle d'animation

```typescript
function drawBlop(ctx: CanvasRenderingContext2D, state: BlopState, t: number) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  
  const breathY = Math.sin(t * 0.002) * 3  // respiration douce
  const x = state.x + state.shakeOffset
  const y = state.y + state.jumpOffset + breathY

  // Corps
  ctx.beginPath()
  ctx.ellipse(x, y, state.bodyW / 2, state.bodyH / 2, 0, 0, Math.PI * 2)
  ctx.fillStyle = state.color
  ctx.fill()

  // Oreilles
  ctx.beginPath()
  ctx.ellipse(x - state.bodyW / 2 + 5, y - 20, 12, 20, -0.3, 0, Math.PI * 2)
  ctx.ellipse(x + state.bodyW / 2 - 5, y - 20, 12, 20, 0.3, 0, Math.PI * 2)
  ctx.fillStyle = state.color
  ctx.fill()

  // Yeux
  drawEyes(ctx, x, y, state)

  // Bouche
  drawMouth(ctx, x, y, state)

  // Larme (si action en retard)
  if (state.mood === 'sad' || state.mood === 'distressed') {
    drawTear(ctx, x, y, t)
  }
}
```

### Interpolation de couleur

```typescript
const MOOD_COLORS = {
  euphoric:   '#7B2FBE',
  happy:      '#5B8DEF',
  stressed:   '#FF8C00',
  sad:        '#FF4444',
  distressed: '#FF3333',
}

function interpolateColor(from: string, to: string, t: number): string {
  // Lerp RGB entre les deux couleurs selon t (0-1)
  // t = transition progressive sur 2s quand le mood change
}
```

### Animations spéciales

```typescript
// Saut (célébration)
function triggerJump(blopRef: React.MutableRefObject<BlopState>) {
  let frame = 0
  const animate = () => {
    blopRef.current.jumpOffset = -Math.sin(frame / 10 * Math.PI) * 40
    frame++
    if (frame < 20) requestAnimationFrame(animate)
    else blopRef.current.jumpOffset = 0
  }
  requestAnimationFrame(animate)
}

// Tremblement (stress)
function triggerShake(blopRef: React.MutableRefObject<BlopState>) {
  let frame = 0
  const animate = () => {
    blopRef.current.shakeOffset = (Math.random() - 0.5) * 8
    frame++
    if (frame < 30) requestAnimationFrame(animate)
    else blopRef.current.shakeOffset = 0
  }
  requestAnimationFrame(animate)
}
```

---

## Évolution de Blop entre les réunions

| Niveau | Condition | Apparence |
|---|---|---|
| 1-3 | Départ | Petite taille, couleurs ternes |
| 4-6 | 3 réunions consécutives > 60 happiness | Taille normale, couleurs vives |
| 7-9 | 6 réunions consécutives > 70 happiness | Grand, effet brillant |
| 10 | 10 réunions > 80 happiness | Particules autour de Blop |

**XP system :**
- +10 XP par réunion terminée
- +5 XP bonus si happiness > 70
- -5 XP si happiness < 30
- 100 XP = level up

**Régression :**
- 2 réunions consécutives < 30 happiness → Blop perd 1 niveau

---

## BlopStats — Barres de métriques

```tsx
// BlopStats.tsx
const metrics = [
  { label: 'Énergie',   value: state.energy,   color: '#5B8DEF' },
  { label: 'Équilibre', value: state.balance,  color: '#7B2FBE' },
  { label: 'Focus',     value: state.focus,    color: '#FF8C00' },
  { label: 'Bonheur',   value: state.happiness, color: '#4CAF50' },
]

// Chaque barre : transition CSS smooth sur 500ms quand la valeur change
// className="transition-all duration-500"
```
