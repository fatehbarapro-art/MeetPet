# Intégration Discord

> Dernière mise à jour : 2026-05-05

---

## Pourquoi Discord

Discord fournit **un flux audio séparé par utilisateur** → diarisation native sans IA supplémentaire.
Chaque membre du vocal a son propre `AudioReceiveStream`, identifié par son `userId`.

---

## Setup Discord Bot

### 1. Créer l'application sur Discord Developer Portal

1. Aller sur https://discord.com/developers/applications
2. "New Application" → nommer "MeetPet" / "Blop"
3. Onglet "Bot" → "Add Bot" → copier le token → `DISCORD_BOT_TOKEN`
4. Onglet "OAuth2" → copier `CLIENT_ID` → `DISCORD_CLIENT_ID`
5. Activer les **Privileged Intents** :
   - ✅ Server Members Intent
   - ✅ Message Content Intent

### 2. Permissions requises

Scopes OAuth2 : `bot`, `applications.commands`

Permissions bot :
- Read Messages / View Channels
- Send Messages
- Embed Links
- Connect (voice)
- Speak (voice)
- Use Voice Activity

### 3. Inviter le bot sur le serveur

URL pattern :
```
https://discord.com/api/oauth2/authorize?client_id=CLIENT_ID&permissions=PERMISSIONS&scope=bot%20applications.commands
```

---

## Architecture du bot

```typescript
// integrations/discord/discordBot.ts

import { Client, GatewayIntentBits } from 'discord.js'
import { joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus } from '@discordjs/voice'

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
  ]
})
```

---

## Slash Commands

| Commande | Description |
|---|---|
| `/meetpet start [titre]` | Bot rejoint le vocal + démarre la réunion |
| `/meetpet stop` | Bot quitte + envoie le compte-rendu |
| `/meetpet status` | Affiche état Blop + actions en cours |
| `/meetpet actions` | Liste les actions en attente |

### Enregistrement des commands (dev)

```typescript
// discordCommands.ts
import { REST, Routes, SlashCommandBuilder } from 'discord.js'

const commands = [
  new SlashCommandBuilder()
    .setName('meetpet')
    .setDescription('Commandes MeetPet')
    .addSubcommand(sub => sub.setName('start').setDescription('Démarrer une réunion')
      .addStringOption(opt => opt.setName('titre').setDescription('Nom de la réunion')))
    .addSubcommand(sub => sub.setName('stop').setDescription('Terminer la réunion'))
    .addSubcommand(sub => sub.setName('status').setDescription("État de Blop"))
    .addSubcommand(sub => sub.setName('actions').setDescription('Actions en attente'))
]

const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN!)
await rest.put(
  Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID!, process.env.DISCORD_GUILD_ID!),
  { body: commands }
)
```

---

## Pipeline audio par speaker

```typescript
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  EndBehaviorType,
  StreamType,
} from '@discordjs/voice'
import { OpusDecoder } from '@discordjs/opus'

async function startListening(connection: VoiceConnection, channel: VoiceChannel) {
  const receiver = connection.receiver

  // Écouter chaque membre qui rejoint le vocal
  connection.receiver.speaking.on('start', (userId) => {
    const member = channel.members.get(userId)
    const displayName = member?.displayName ?? userId

    const stream = receiver.subscribe(userId, {
      end: { behavior: EndBehaviorType.AfterSilence, duration: 500 }
    })

    const decoder = new OpusDecoder()
    stream.pipe(decoder)

    const chunks: Buffer[] = []
    decoder.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
      // Envoyer chunk à MiniMax STT toutes les 100ms
      // → audioService.sendChunk(userId, displayName, chunk)
    })

    stream.on('end', () => {
      // Segment terminé (silence 500ms)
      // → audioService.flushSpeaker(userId, displayName, Buffer.concat(chunks))
    })
  })
}
```

---

## Jouer audio dans le vocal (Blop parle)

```typescript
import { createAudioPlayer, createAudioResource, AudioPlayerStatus } from '@discordjs/voice'
import { Readable } from 'stream'

async function blopSpeak(connection: VoiceConnection, audioBuffer: Buffer) {
  const player = createAudioPlayer()
  const readable = Readable.from(audioBuffer)
  const resource = createAudioResource(readable, { inputType: StreamType.Arbitrary })

  connection.subscribe(player)
  player.play(resource)

  await new Promise<void>(resolve => {
    player.on(AudioPlayerStatus.Idle, () => resolve())
  })
}
```

---

## Compte-rendu Discord (Embed)

```typescript
import { EmbedBuilder } from 'discord.js'

function buildSummaryEmbed(summary: MeetingSummary): EmbedBuilder {
  const moodColor = summary.blopHappiness >= 60 ? 0x7B2FBE : 
                    summary.blopHappiness >= 40 ? 0xFF8C00 : 0xFF3333
  
  const actionsText = summary.actions
    .map(a => `${a.status === 'done' ? '✅' : a.status === 'overdue' ? '🔴' : '⏳'} **${a.assignee}** : ${a.text}`)
    .join('\n')

  return new EmbedBuilder()
    .setTitle(`📋 ${summary.title} — ${summary.durationMin} min`)
    .setColor(moodColor)
    .addFields(
      { name: '🎭 Humeur de Blop', value: `${summary.blopMood} (${summary.blopHappiness}/100)`, inline: true },
      { name: '👥 Participants', value: summary.speakers.map(s => `${s.name} (${Math.round(s.talkPercent)}%)`).join(', '), inline: false },
      { name: '📌 Actions détectées', value: actionsText || 'Aucune action détectée', inline: false },
      { name: '🔗 Compte-rendu complet', value: `[Voir sur MeetPet](${process.env.APP_URL}/summary/${summary.id})` }
    )
    .setFooter({ text: 'MeetPet • Powered by MiniMax + Kimi' })
    .setTimestamp()
}
```

---

## DM individuel par participant

```typescript
async function sendIndividualDMs(guild: Guild, summary: MeetingSummary) {
  for (const speaker of summary.speakers) {
    const member = guild.members.cache.find(m => m.displayName === speaker.name)
    if (!member) continue

    const myActions = summary.actions.filter(a => a.assignee === speaker.name)
    if (myActions.length === 0) continue

    const dm = await member.createDM()
    await dm.send({
      content: `**Tes actions de la réunion "${summary.title}" :**\n` +
        myActions.map(a => `• ${a.text}${a.deadline ? ` *(deadline : ${a.deadline})*` : ''}`).join('\n')
    })
  }
}
```

---

## Dépendances à installer

```bash
npm install discord.js @discordjs/voice @discordjs/opus sodium-native
```

> ⚠️ `sodium-native` peut nécessiter des outils de compilation natifs (node-gyp).
> Fallback si problème : `npm install libsodium-wrappers` et adapter l'import.
>
> ⚠️ `@discordjs/opus` nécessite également une compilation native.
> Fallback : `npm install opusscript` (plus lent mais pur JS).
