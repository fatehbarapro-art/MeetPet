import type { BlopState, MeetingAnalysis } from '../types/index.js'

export function computeBlopState(
  analysis: MeetingAnalysis,
  durationMin: number,
  overdueActions: number,
  currentLevel: number
): BlopState {
  const speakerValues = Object.values(analysis.speakingTime)
  const balanceScore = computeBalanceScore(speakerValues)
  const actionsScore = Math.max(0, 100 - overdueActions * 10)
  const durationScore = durationMin <= 60 ? 100 : Math.max(0, 100 - (durationMin - 60) * 2)
  const clarityScore = analysis.actions.length > 0 ? 100 : 50

  const happiness = Math.round(
    balanceScore * 0.4 +
    actionsScore * 0.3 +
    durationScore * 0.15 +
    clarityScore * 0.15
  )

  return {
    energy: analysis.blopMood.energy,
    balance: analysis.blopMood.balance,
    focus: analysis.blopMood.focus,
    happiness,
    level: currentLevel,
    mood: moodFromScore(happiness),
    reason: analysis.blopMood.reason,
  }
}

function computeBalanceScore(values: number[]): number {
  if (values.length <= 1) return 100
  const avg = 1 / values.length
  const maxDev = Math.max(...values.map(v => Math.abs(v - avg)))
  const devPct = (maxDev / avg) * 100
  return Math.max(0, 100 - Math.max(0, devPct - 15) * 2)
}

export function moodFromScore(happiness: number): BlopState['mood'] {
  if (happiness >= 80) return 'euphoric'
  if (happiness >= 60) return 'happy'
  if (happiness >= 40) return 'stressed'
  if (happiness >= 20) return 'sad'
  return 'distressed'
}

export function defaultBlopState(): BlopState {
  return { energy: 80, balance: 80, focus: 80, happiness: 80, level: 1, mood: 'happy' }
}

export function blopInterventionText(trigger: string, context: Record<string, string>): string | null {
  switch (trigger) {
    case 'dominance':
      return `Hey, ${context.speaker} parle depuis ${context.minutes} minutes. ${context.other ?? 'Quelqu\'un d\'autre'}, t'as un avis ?`
    case 'silence':
      return `Vous êtes encore là ? Le silence me stresse un peu.`
    case 'overdue':
      return `Les ${context.item ?? 'tâches'} de ${context.speaker ?? 'quelqu\'un'} sont en retard... je suis un peu triste.`
    case 'celebration':
      return `Super réunion ! Tout le monde a parlé, ${context.actionCount ?? 'plusieurs'} actions claires. Je suis heureux !`
    case 'end_fast':
      return `On a fini en ${context.minutes} minutes avec ${context.actionCount} actions. Je prends ça !`
    default:
      return null
  }
}
