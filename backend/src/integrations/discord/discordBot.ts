import {
  Client,
  GatewayIntentBits,
  ChatInputCommandInteraction,
  VoiceChannel,
  TextChannel,
} from 'discord.js'
import {
  joinVoiceChannel,
  getVoiceConnection,
  EndBehaviorType,
  createAudioPlayer,
  createAudioResource,
  StreamType,
  AudioPlayerStatus,
  VoiceConnection,
} from '@discordjs/voice'
import prism from 'prism-media'
import { Readable } from 'stream'
import { registerCommands } from './discordCommands.js'
import { buildSummaryEmbed } from './discordEmbeds.js'
import { transcribeAudio } from '../../utils/groq.js'
import { analyzeTranscript, generateSummary, synthesizeSpeech } from '../../utils/minimax.js'
import { onSpeakerStart, onSpeakerEnd, startEventLoop } from '../../services/eventService.js'
import { computeBlopState, defaultBlopState, blopInterventionText } from '../../services/blopService.js'
import { broadcast } from '../../server.js'
import { prisma } from '../../server.js'
import type { MeetingSession } from '../../types/index.js'

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
  ],
})

// Session active par guild
const sessions = new Map<string, MeetingSession>()

export async function initDiscordBot() {
  client.once('ready', async () => {
    console.log(`✅ Discord bot connecté : ${client.user?.tag}`)
    await registerCommands()
  })

  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return
    const cmd = interaction as ChatInputCommandInteraction
    if (cmd.commandName !== 'meetpet') return

    const sub = cmd.options.getSubcommand()
    if (sub === 'start') await handleStart(cmd)
    else if (sub === 'stop') await handleStop(cmd)
    else if (sub === 'status') await handleStatus(cmd)
    else if (sub === 'actions') await handleActions(cmd)
  })

  await client.login(process.env.DISCORD_BOT_TOKEN)
}

async function handleStart(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild!
  const member = await guild.members.fetch(interaction.user.id)
  const voiceChannel = member.voice.channel as VoiceChannel | null

  if (!voiceChannel) {
    await interaction.reply({ content: '❌ Rejoins un canal vocal d\'abord.', ephemeral: true })
    return
  }
  if (sessions.has(guild.id)) {
    await interaction.reply({ content: '⚠️ Une réunion est déjà en cours.', ephemeral: true })
    return
  }

  await interaction.deferReply()

  const title = interaction.options.getString('titre') ?? `Réunion ${new Date().toLocaleDateString('fr-FR')}`

  // Créer la réunion en DB
  let team = await prisma.team.findUnique({ where: { discordGuildId: guild.id } })
  if (!team) {
    team = await prisma.team.create({ data: { name: guild.name, discordGuildId: guild.id } })
  }
  const meeting = await prisma.meeting.create({
    data: {
      title,
      teamId: team.id,
      discordVoiceChannelId: voiceChannel.id,
      discordChannelId: interaction.channelId,
      startedAt: new Date(),
    },
  })

  const session: MeetingSession = {
    id: meeting.id,
    title,
    guildId: guild.id,
    voiceChannelId: voiceChannel.id,
    textChannelId: interaction.channelId,
    startedAt: Date.now(),
    transcript: [],
    speakerSeconds: {},
    knownSpeakers: new Set(),
    activeSpeaker: null,
    activeSpeakerStart: null,
    lastSpeechAt: Date.now(),
    blopState: defaultBlopState(),
  }

  sessions.set(guild.id, session)

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: guild.id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adapterCreator: guild.voiceAdapterCreator as any,
    selfDeaf: false,
  })

  startAudioPipeline(connection, voiceChannel, session)

  // Analyse toutes les 30s
  session.analysisTimer = setInterval(() => runAnalysis(session, connection), 30_000)
  startEventLoop(session)

  broadcast({ type: 'meeting_started', meetingId: meeting.id, title, participants: [] })

  await interaction.editReply(`🎙️ **${title}** démarrée ! Blop écoute dans **${voiceChannel.name}**.`)
}

async function handleStop(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId!
  const session = sessions.get(guildId)
  if (!session) {
    await interaction.reply({ content: '❌ Aucune réunion en cours.', ephemeral: true })
    return
  }

  await interaction.deferReply()
  clearInterval(session.analysisTimer)
  getVoiceConnection(guildId)?.destroy()
  sessions.delete(guildId)

  const durationMin = Math.round((Date.now() - session.startedAt) / 60000)
  const fullTranscript = session.transcript.map(s => `${s.speaker}: ${s.text}`).join('\n')

  const summary = await generateSummary(fullTranscript, session.title, durationMin)
  const actions = await prisma.action.findMany({ where: { meetingId: session.id } })

  await prisma.meeting.update({
    where: { id: session.id },
    data: { endedAt: new Date(), summary, durationMin },
  })

  const summaryUrl = `${process.env.VITE_API_URL?.replace('/api', '')}/summary/${session.id}`
  const embed = buildSummaryEmbed(session.title, durationMin, session.blopState, actions, summaryUrl)

  const channel = interaction.channel as TextChannel
  await channel.send({ embeds: [embed] })
  broadcast({ type: 'meeting_ended', meetingId: session.id, summaryUrl })

  await interaction.editReply('✅ Réunion terminée ! Compte-rendu posté ci-dessus.')
}

async function handleStatus(interaction: ChatInputCommandInteraction) {
  const session = sessions.get(interaction.guildId!)
  if (!session) {
    await interaction.reply({ content: 'Aucune réunion en cours.', ephemeral: true })
    return
  }
  const s = session.blopState
  await interaction.reply({
    content: `🐾 **Blop** — ${s.mood} (${s.happiness}/100)\nÉnergie ${s.energy} | Équilibre ${s.balance} | Focus ${s.focus}\n_${s.reason ?? 'Tout va bien'}_`,
    ephemeral: true,
  })
}

async function handleActions(interaction: ChatInputCommandInteraction) {
  const session = sessions.get(interaction.guildId!)
  if (!session) {
    await interaction.reply({ content: 'Aucune réunion en cours.', ephemeral: true })
    return
  }
  const actions = await prisma.action.findMany({ where: { meetingId: session.id, status: 'pending' } })
  if (actions.length === 0) {
    await interaction.reply({ content: 'Aucune action détectée pour le moment.', ephemeral: true })
    return
  }
  const list = actions.map(a => `⏳ **${a.assignee}** : ${a.text}`).join('\n')
  await interaction.reply({ content: `📌 **Actions en attente :**\n${list}`, ephemeral: true })
}

function startAudioPipeline(
  connection: VoiceConnection,
  voiceChannel: VoiceChannel,
  session: MeetingSession
) {
  const receiver = connection.receiver

  receiver.speaking.on('start', (userId: string) => {
    const member = voiceChannel.members.get(userId)
    const displayName = member?.displayName ?? userId

    onSpeakerStart(userId, displayName, session)

    const stream = receiver.subscribe(userId, {
      end: { behavior: EndBehaviorType.AfterSilence, duration: 500 },
    })

    const decoder = new prism.opus.Decoder({ frameSize: 960, channels: 1, rate: 48000 })
    const chunks: Buffer[] = []
    const startTime = Date.now()

    stream.pipe(decoder)
    decoder.on('data', (chunk: Buffer) => chunks.push(chunk))

    stream.on('end', async () => {
      const seconds = (Date.now() - startTime) / 1000
      onSpeakerEnd(userId, seconds, session)

      const pcm = Buffer.concat(chunks)
      const { text } = await transcribeAudio(pcm, displayName)
      if (!text) return

      const segment = { speaker: displayName, text, timestamp: Date.now() }
      session.transcript.push(segment)
      session.lastSpeechAt = Date.now()

      broadcast({ type: 'transcript', ...segment })
    })
  })
}

async function runAnalysis(session: MeetingSession, connection: VoiceConnection) {
  if (session.transcript.length === 0) return

  const recent = session.transcript.slice(-20).map(s => `${s.speaker}: ${s.text}`).join('\n')

  try {
    const analysis = await analyzeTranscript(recent)
    const durationMin = Math.round((Date.now() - session.startedAt) / 60000)
    const overdueCount = await prisma.action.count({ where: { meetingId: session.id, status: 'overdue' } })

    const blopState = computeBlopState(analysis, durationMin, overdueCount, session.blopState.level)
    session.blopState = blopState
    broadcast({ type: 'blop_update', state: blopState })

    // Persister les nouvelles actions
    for (const a of analysis.actions) {
      if (a.confidence >= 0.7) {
        const created = await prisma.action.create({
          data: {
            meetingId: session.id,
            text: a.text,
            assignee: a.assignee,
            deadline: a.deadline ? new Date(a.deadline) : null,
            confidence: a.confidence,
          },
        })
        broadcast({ type: 'action_detected', action: { id: created.id, ...a } })
      }
    }

    // Intervention Blop si dominance
    if (analysis.dominanceAlert) {
      const { speaker, minutes } = analysis.dominanceAlert
      const speakers = Object.keys(analysis.speakingTime).filter(s => s !== speaker)
      const other = speakers[0]
      const text = blopInterventionText('dominance', { speaker, minutes: String(minutes), other })
      if (text) await blopSpeak(connection, text, session)
    }

  } catch (err) {
    console.error('Analyse MiniMax échouée :', err)
  }
}

async function blopSpeak(connection: VoiceConnection, text: string, session: MeetingSession) {
  try {
    const mp3 = await synthesizeSpeech(text)
    const player = createAudioPlayer()
    const resource = createAudioResource(Readable.from(mp3), { inputType: StreamType.Arbitrary })
    connection.subscribe(player)
    player.play(resource)
    await new Promise<void>(resolve => player.on(AudioPlayerStatus.Idle, () => resolve()))
    broadcast({ type: 'blop_speech', text, trigger: 'dominance' })
    session.transcript.push({ speaker: '🎙️ Blop', text, timestamp: Date.now() })
  } catch (err) {
    // Fallback : on broadcast quand même
    console.error('TTS échoué, fallback texte :', err)
    broadcast({ type: 'blop_speech', text, trigger: 'dominance' })
  }
}
