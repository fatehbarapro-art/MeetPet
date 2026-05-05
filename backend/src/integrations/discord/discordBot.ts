import {
  Client,
  GatewayIntentBits,
  ChatInputCommandInteraction,
  VoiceChannel,
  TextChannel,
  PermissionFlagsBits,
  GuildMember,
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
  VoiceConnectionStatus,
  entersState,
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
import type { MeetingRuleEvent } from '../../services/eventService.js'

const discordJsVersion = '14.26.4'
const discordVoiceVersion = '0.18.0'
const discordOpusVersion = '0.9.0'
const sodiumNativeVersion = '4.3.3'

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
  ],
})

// Session active par guild
const sessions = new Map<string, MeetingSession>()
let voiceAttemptSeq = 0

export function getActiveMeetingSession(): MeetingSession | null {
  return sessions.values().next().value ?? null
}

export async function initDiscordBot() {
  client.once('ready', async () => {
    console.log(`✅ Discord bot connecté : ${client.user?.tag}`)
    logDiscordRuntime()
    await registerCommands()
  })

  client.on('raw', packet => logVoiceGatewayPacket(packet))

  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return
    const cmd = interaction as ChatInputCommandInteraction
    if (cmd.commandName !== 'meetpet') return

    try {
      const sub = cmd.options.getSubcommand()
      if (sub === 'start') await handleStart(cmd)
      else if (sub === 'stop') await handleStop(cmd)
      else if (sub === 'status') await handleStatus(cmd)
      else if (sub === 'actions') await handleActions(cmd)
    } catch (err) {
      console.error('Commande /meetpet échouée :', err)
      await respondInteractionError(cmd)
    }
  })

  await client.login(process.env.DISCORD_BOT_TOKEN)
}

async function handleStart(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply()

  const guild = interaction.guild!
  const member = await guild.members.fetch(interaction.user.id)
  const voiceChannel = member.voice.channel as VoiceChannel | null

  if (!voiceChannel) {
    await interaction.editReply('❌ Rejoins un canal vocal d\'abord.')
    return
  }
  if (sessions.has(guild.id)) {
    await interaction.editReply('⚠️ Une réunion est déjà en cours.')
    return
  }

  const title = interaction.options.getString('titre') ?? `Réunion ${new Date().toLocaleDateString('fr-FR')}`
  const attemptId = nextVoiceAttemptId()

  logVoicePreflight(attemptId, voiceChannel, member)

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: guild.id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adapterCreator: guild.voiceAdapterCreator as any,
    selfDeaf: false,
    selfMute: false,
    debug: true,
  })

  logVoiceConnection(attemptId, connection)

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 30_000)
  } catch (err) {
    console.error(`[voice:${attemptId}] ❌ Connexion vocale jamais prête dans #${voiceChannel.name} :`, err)
    connection.destroy()
    await interaction.editReply(
      `❌ Blop a rejoint **${voiceChannel.name}**, mais Discord Voice n'est pas passé en état prêt. ` +
      'Vérifie les permissions vocales du bot et relance `/meetpet start`.'
    )
    return
  }

  console.log(`[voice:${attemptId}] ✅ Connexion vocale prête dans #${voiceChannel.name}`)

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
    speakerNames: {},
    knownSpeakers: new Set(),
    activeSpeaker: null,
    activeSpeakerStart: null,
    lastDominanceAlertAt: null,
    lastSilenceAlertAt: null,
    lastSpeechAt: Date.now(),
    blopState: defaultBlopState(),
  }

  sessions.set(guild.id, session)

  startAudioPipeline(attemptId, connection, voiceChannel, session)

  // Analyse toutes les 30s
  session.analysisTimer = setInterval(() => runAnalysis(session, connection), 30_000)
  session.eventTimer = startEventLoop(session, event => handleMeetingRuleEvent(event, connection, session))

  broadcast({ type: 'meeting_started', meetingId: meeting.id, title, participants: [] })

  await interaction.editReply(`🎙️ **${title}** démarrée ! Blop écoute dans **${voiceChannel.name}**.`)
}

async function handleStop(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply()

  const guildId = interaction.guildId!
  const session = sessions.get(guildId)
  if (!session) {
    await interaction.editReply('❌ Aucune réunion en cours.')
    return
  }

  clearInterval(session.analysisTimer)
  clearInterval(session.eventTimer)
  getVoiceConnection(guildId)?.destroy()
  sessions.delete(guildId)

  const durationMin = Math.round((Date.now() - session.startedAt) / 60000)
  const fullTranscript = session.transcript.map(s => `${s.speaker}: ${s.text}`).join('\n')

  let summary = ''
  try {
    summary = await generateSummary(fullTranscript, session.title, durationMin)
  } catch (err) {
    console.error('generateSummary échoué :', err)
    summary = `## ${session.title}\nCompte-rendu indisponible (erreur MiniMax).`
  }

  const actions = await prisma.action.findMany({ where: { meetingId: session.id } })

  await persistCompletedSession(session, summary, durationMin)

  const summaryUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/summary/${session.id}`
  const embed = buildSummaryEmbed(session.title, durationMin, session.blopState, actions, summaryUrl)

  try {
    const channel = interaction.channel as TextChannel
    await channel.send({ embeds: [embed] })
  } catch (err) {
    console.error('Envoi embed Discord échoué :', err)
  }

  broadcast({ type: 'meeting_ended', meetingId: session.id, summaryUrl })
  await interaction.editReply('✅ Réunion terminée ! Compte-rendu posté ci-dessus.')
}

async function handleStatus(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true })

  const session = sessions.get(interaction.guildId!)
  if (!session) {
    await interaction.editReply('Aucune réunion en cours.')
    return
  }
  const s = session.blopState
  await interaction.editReply(`🐾 **Blop** — ${s.mood} (${s.happiness}/100)\nÉnergie ${s.energy} | Équilibre ${s.balance} | Focus ${s.focus}\n_${s.reason ?? 'Tout va bien'}_`)
}

async function handleActions(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true })

  const session = sessions.get(interaction.guildId!)
  if (!session) {
    await interaction.editReply('Aucune réunion en cours.')
    return
  }
  const actions = await prisma.action.findMany({ where: { meetingId: session.id, status: 'pending' } })
  if (actions.length === 0) {
    await interaction.editReply('Aucune action détectée pour le moment.')
    return
  }
  const list = actions.map(a => `⏳ **${a.assignee}** : ${a.text}`).join('\n')
  await interaction.editReply(`📌 **Actions en attente :**\n${list}`)
}

async function respondInteractionError(interaction: ChatInputCommandInteraction) {
  const content = '❌ MeetPet a rencontré une erreur côté serveur. Regarde le terminal backend pour le détail.'

  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(content)
      return
    }
    await interaction.reply({ content, ephemeral: true })
  } catch (err) {
    console.error('Impossible de répondre à l\'interaction Discord :', err)
  }
}

function startAudioPipeline(
  attemptId: string,
  connection: VoiceConnection,
  voiceChannel: VoiceChannel,
  session: MeetingSession
) {
  const receiver = connection.receiver
  console.log(`[voice:${attemptId}] 👂 Pipeline audio prêt pour ${voiceChannel.members.size} membre(s) dans #${voiceChannel.name}`)
  broadcast({ type: 'blop_event', event: 'audio_ready', blopDelta: 0, message: `Audio prêt dans ${voiceChannel.name}.` })

  receiver.speaking.on('end', (userId: string) => {
    const displayName = session.speakerNames[userId] ?? userId
    console.log(`[voice:${attemptId}] 🤐 ${displayName} arrête de parler`)
  })

  receiver.speaking.on('start', (userId: string) => {
    const member = voiceChannel.members.get(userId)
    const displayName = member?.displayName ?? userId
    console.log(`[voice:${attemptId}] 🎙️ ${displayName} commence à parler`)

    onSpeakerStart(userId, displayName, session)

    const stream = receiver.subscribe(userId, {
      end: { behavior: EndBehaviorType.AfterSilence, duration: 500 },
    })

    const decoder = new prism.opus.Decoder({ frameSize: 960, channels: 1, rate: 48000 })
    const chunks: Buffer[] = []
    const startTime = Date.now()

    stream.on('error', err => console.error(`[voice:${attemptId}] ❌ Stream audio Discord erreur pour ${displayName} :`, err))
    decoder.on('error', err => console.error(`[voice:${attemptId}] ❌ Decodeur Opus erreur pour ${displayName} :`, err))
    stream.pipe(decoder)
    decoder.on('data', (chunk: Buffer) => chunks.push(chunk))

    stream.on('end', async () => {
      const seconds = (Date.now() - startTime) / 1000
      onSpeakerEnd(userId, seconds, session)

      const pcm = Buffer.concat(chunks)
      console.log(`[voice:${attemptId}] 🔊 ${displayName} — ${seconds.toFixed(1)}s de son (${pcm.length} bytes PCM)`)

      try {
        const { text } = await transcribeAudio(pcm, displayName)
        console.log(`[voice:${attemptId}] 📝 Groq STT → "${text}"`)
        if (!text) return

        const segment = { speaker: displayName, text, timestamp: Date.now() }
        session.transcript.push(segment)
        session.lastSpeechAt = Date.now()
        broadcast({ type: 'transcript', ...segment })
      } catch (err) {
        console.error(`[voice:${attemptId}] ❌ Groq STT erreur pour ${displayName} :`, err)
      }
    })
  })
}

function logVoiceConnection(attemptId: string, connection: VoiceConnection) {
  connection.on('debug', message => console.log(`[voice:${attemptId}] 🔎 ${redactSecrets(message)}`))
  connection.on('stateChange', (oldState, newState) => {
    console.log(`[voice:${attemptId}] 🔌 Voice ${oldState.status} → ${newState.status}`)
  })
  connection.on('error', err => console.error(`[voice:${attemptId}] ❌ Connexion vocale Discord erreur :`, err))
}

function nextVoiceAttemptId() {
  voiceAttemptSeq += 1
  return `${Date.now().toString(36)}-${voiceAttemptSeq}`
}

function logDiscordRuntime() {
  console.log([
    '🧪 Runtime Discord',
    `node=${process.version}`,
    `discord.js=${discordJsVersion}`,
    `@discordjs/voice=${discordVoiceVersion}`,
    `@discordjs/opus=${discordOpusVersion}`,
    `sodium-native=${sodiumNativeVersion}`,
  ].join(' | '))
}

function logVoicePreflight(
  attemptId: string,
  voiceChannel: VoiceChannel,
  member: GuildMember
) {
  const botMember = voiceChannel.guild.members.me
  const permissions = botMember ? voiceChannel.permissionsFor(botMember) : null
  const userVoice = member.voice

  console.log(`[voice:${attemptId}] 🧭 Preflight`, {
    guildId: voiceChannel.guild.id,
    channelId: voiceChannel.id,
    channelName: voiceChannel.name,
    channelType: voiceChannel.type,
    rtcRegion: voiceChannel.rtcRegion,
    joinable: voiceChannel.joinable,
    speakable: voiceChannel.speakable,
    membersInChannel: voiceChannel.members.map(channelMember => ({
      id: channelMember.id,
      bot: channelMember.user.bot,
      displayName: channelMember.displayName,
      voice: {
        selfMute: channelMember.voice.selfMute,
        selfDeaf: channelMember.voice.selfDeaf,
        serverMute: channelMember.voice.serverMute,
        serverDeaf: channelMember.voice.serverDeaf,
      },
    })),
    commandUserVoice: {
      channelId: userVoice.channelId,
      selfMute: userVoice.selfMute,
      selfDeaf: userVoice.selfDeaf,
      serverMute: userVoice.serverMute,
      serverDeaf: userVoice.serverDeaf,
    },
    botPermissions: permissions ? {
      viewChannel: permissions.has(PermissionFlagsBits.ViewChannel),
      connect: permissions.has(PermissionFlagsBits.Connect),
      speak: permissions.has(PermissionFlagsBits.Speak),
      useVAD: permissions.has(PermissionFlagsBits.UseVAD),
      administrator: permissions.has(PermissionFlagsBits.Administrator),
    } : null,
  })
}

function logVoiceGatewayPacket(packet: unknown) {
  if (!isGatewayPacket(packet)) return
  if (packet.t !== 'VOICE_STATE_UPDATE' && packet.t !== 'VOICE_SERVER_UPDATE') return

  const data = packet.d as Record<string, unknown>
  const safeData = packet.t === 'VOICE_SERVER_UPDATE'
    ? { ...data, token: data.token ? '[redacted]' : undefined }
    : data

  console.log(`📡 Gateway ${packet.t}`, safeData)
}

function isGatewayPacket(packet: unknown): packet is { t?: string; d?: unknown } {
  return Boolean(packet && typeof packet === 'object' && 't' in packet)
}

function redactSecrets(message: string) {
  return message
    .replace(/"token":"[^"]+"/g, '"token":"[redacted]"')
    .replace(/"session_id":"[^"]+"/g, '"session_id":"[redacted]"')
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
      if (text) await blopSpeak(connection, text, session, 'dominance')
    }

  } catch (err) {
    console.error('Analyse MiniMax échouée :', err)
  }
}

async function handleMeetingRuleEvent(
  event: MeetingRuleEvent,
  connection: VoiceConnection,
  session: MeetingSession
) {
  if (event.type === 'dominance') {
    const other = Object.values(session.speakerNames).find(name => name !== event.speaker)
    const text = blopInterventionText('dominance', {
      speaker: event.speaker,
      minutes: String(event.minutes),
      ...(other ? { other } : {}),
    })
    if (text) await blopSpeak(connection, text, session, 'dominance')
  }

  if (event.type === 'silence') {
    const text = blopInterventionText('silence', {})
    if (text) await blopSpeak(connection, text, session, 'silence')
  }
}

async function blopSpeak(
  connection: VoiceConnection,
  text: string,
  session: MeetingSession,
  trigger: string
) {
  try {
    const mp3 = await synthesizeSpeech(text)
    const player = createAudioPlayer()
    const resource = createAudioResource(Readable.from(mp3), { inputType: StreamType.Arbitrary })
    connection.subscribe(player)
    player.play(resource)
    await new Promise<void>(resolve => player.on(AudioPlayerStatus.Idle, () => resolve()))
  } catch (err) {
    // Fallback : on broadcast quand même
    console.error('TTS échoué, fallback texte :', err)
  }

  broadcast({ type: 'blop_speech', text, trigger })
  session.transcript.push({ speaker: '🎙️ Blop', text, timestamp: Date.now() })
}

async function persistCompletedSession(
  session: MeetingSession,
  summary: string,
  durationMin: number
) {
  const transcript = session.transcript.map(s => `${s.speaker}: ${s.text}`).join('\n')
  const totalSeconds = Object.values(session.speakerSeconds).reduce((sum, seconds) => sum + seconds, 0)
  const speakerWrites = Object.entries(session.speakerSeconds)
    .filter(([, seconds]) => seconds > 0)
    .map(([userId, seconds]) => prisma.speaker.create({
      data: {
        meetingId: session.id,
        discordUserId: userId,
        name: session.speakerNames[userId] ?? userId,
        talkSeconds: Math.round(seconds),
        talkPercent: totalSeconds > 0 ? (seconds / totalSeconds) * 100 : 0,
      },
    }))

  await prisma.$transaction([
    prisma.speaker.deleteMany({ where: { meetingId: session.id } }),
    prisma.blopState.upsert({
      where: { meetingId: session.id },
      create: {
        meetingId: session.id,
        energy: session.blopState.energy,
        balance: session.blopState.balance,
        focus: session.blopState.focus,
        happiness: session.blopState.happiness,
        level: session.blopState.level,
        mood: session.blopState.mood,
        reason: session.blopState.reason,
      },
      update: {
        energy: session.blopState.energy,
        balance: session.blopState.balance,
        focus: session.blopState.focus,
        happiness: session.blopState.happiness,
        level: session.blopState.level,
        mood: session.blopState.mood,
        reason: session.blopState.reason,
      },
    }),
    prisma.meeting.update({
      where: { id: session.id },
      data: { endedAt: new Date(), summary, durationMin, transcript },
    }),
    ...speakerWrites,
  ])
}
