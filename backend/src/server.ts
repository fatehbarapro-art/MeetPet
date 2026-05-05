import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { PrismaClient } from '@prisma/client'
import { initDiscordBot } from './integrations/discord/discordBot.js'

export const prisma = new PrismaClient()
const app = express()
app.use(express.json())

const httpServer = createServer(app)
const wss = new WebSocketServer({ server: httpServer })
const clients = new Set<WebSocket>()

wss.on('connection', ws => {
  clients.add(ws)
  console.log(`WS client connecté (${clients.size} total)`)

  ws.on('close', () => {
    clients.delete(ws)
    console.log(`WS client déconnecté (${clients.size} total)`)
  })

  ws.on('message', raw => {
    try {
      const msg = JSON.parse(raw.toString())
      handleWsMessage(msg)
    } catch {
      // ignore malformed
    }
  })
})

function handleWsMessage(msg: { type: string; [key: string]: unknown }) {
  switch (msg.type) {
    case 'action_complete':
      prisma.action.update({
        where: { id: msg.actionId as string },
        data: { status: 'done', completedAt: new Date() },
      }).catch(console.error)
      break
  }
}

export function broadcast(event: object) {
  const json = JSON.stringify(event)
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) client.send(json)
  }
}

// Routes REST
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

app.get('/api/meetings', async (_req, res) => {
  const meetings = await prisma.meeting.findMany({
    orderBy: { startedAt: 'desc' },
    include: { speakers: true, actions: true, blopState: true },
    take: 20,
  })
  res.json(meetings)
})

app.get('/api/meetings/:id', async (req, res) => {
  const meeting = await prisma.meeting.findUnique({
    where: { id: req.params.id },
    include: { speakers: true, actions: true, blopState: true },
  })
  if (!meeting) { res.status(404).json({ error: 'Not found' }); return }
  res.json(meeting)
})

app.patch('/api/actions/:id', async (req, res) => {
  const action = await prisma.action.update({
    where: { id: req.params.id },
    data: { status: req.body.status, completedAt: req.body.status === 'done' ? new Date() : null },
  })
  res.json(action)
})

const PORT = process.env.PORT ?? 3000

async function main() {
  await prisma.$connect()
  await initDiscordBot()
  httpServer.listen(PORT, () => {
    console.log(`🚀 MeetPet backend sur http://localhost:${PORT}`)
  })
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
