import { EmbedBuilder } from 'discord.js'
import type { BlopState } from '../../types/index.js'

const MOOD_COLORS: Record<string, number> = {
  euphoric:   0x7B2FBE,
  happy:      0x5B8DEF,
  stressed:   0xFF8C00,
  sad:        0xFF4444,
  distressed: 0xFF3333,
}

export function buildSummaryEmbed(
  title: string,
  durationMin: number,
  blopState: BlopState,
  actions: Array<{ text: string; assignee: string; status: string }>,
  summaryUrl: string
): EmbedBuilder {
  const color = MOOD_COLORS[blopState.mood] ?? 0x5B8DEF

  const actionsText = actions.length > 0
    ? actions.map(a => {
        const icon = a.status === 'done' ? '✅' : a.status === 'overdue' ? '🔴' : '⏳'
        return `${icon} **${a.assignee}** : ${a.text}`
      }).join('\n')
    : 'Aucune action détectée'

  const moodEmoji: Record<string, string> = {
    euphoric: '🎉', happy: '😊', stressed: '😰', sad: '😢', distressed: '🚨'
  }

  return new EmbedBuilder()
    .setTitle(`📋 ${title} — ${durationMin} min`)
    .setColor(color)
    .addFields(
      { name: `${moodEmoji[blopState.mood] ?? '🐾'} Blop était`, value: `${blopState.mood} (${blopState.happiness}/100)\n${blopState.reason ?? ''}`, inline: false },
      { name: '📌 Actions', value: actionsText, inline: false },
      { name: '🔗 Compte-rendu complet', value: `[Voir sur MeetPet](${summaryUrl})`, inline: false }
    )
    .setFooter({ text: 'MeetPet • Powered by MiniMax' })
    .setTimestamp()
}
