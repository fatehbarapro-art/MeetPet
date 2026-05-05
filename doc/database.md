# Base de données — Schéma Prisma

> Dernière mise à jour : 2026-05-05

---

## Schéma complet

```prisma
// backend/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Team {
  id          String    @id @default(cuid())
  name        String
  discordGuildId String? @unique
  blopLevel   Int       @default(1)
  blopXp      Int       @default(0)
  meetings    Meeting[]
  createdAt   DateTime  @default(now())
}

model Meeting {
  id          String     @id @default(cuid())
  title       String
  teamId      String
  discordChannelId String?   // channel texte Discord associé
  discordVoiceChannelId String? // channel vocal Discord
  startedAt   DateTime
  endedAt     DateTime?
  transcript  String?    // JSON stringifié (tableau de segments)
  summary     String?    // Markdown généré par Kimi
  durationMin Int?       // durée en minutes (calculée à la fin)
  createdAt   DateTime   @default(now())
  team        Team       @relation(fields: [teamId], references: [id])
  speakers    Speaker[]
  actions     Action[]
  blopState   BlopState?
}

model Speaker {
  id          String   @id @default(cuid())
  meetingId   String
  discordUserId String?
  name        String
  talkPercent Float    // 0-100
  talkSeconds Int      @default(0)
  meeting     Meeting  @relation(fields: [meetingId], references: [id])
}

model Action {
  id          String    @id @default(cuid())
  meetingId   String
  text        String
  assignee    String
  deadline    DateTime?
  status      String    @default("pending")  // pending | done | overdue
  confidence  Float     @default(1.0)
  completedAt DateTime?
  createdAt   DateTime  @default(now())
  meeting     Meeting   @relation(fields: [meetingId], references: [id])
}

model BlopState {
  id          String   @id @default(cuid())
  meetingId   String   @unique
  energy      Int      // 0-100
  balance     Int      // 0-100
  focus       Int      // 0-100
  happiness   Int      // 0-100
  level       Int      @default(1)  // 1-10
  mood        String   // euphoric | happy | stressed | sad | distressed
  reason      String?
  meeting     Meeting  @relation(fields: [meetingId], references: [id])
}
```

---

## Commandes utiles

```bash
# Générer le client Prisma
npx prisma generate

# Créer/mettre à jour la DB
npx prisma db push

# Voir les données (GUI)
npx prisma studio

# Réinitialiser la DB (dev seulement)
npx prisma db push --force-reset
```

---

## Requêtes courantes

```typescript
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// Créer une réunion
const meeting = await prisma.meeting.create({
  data: {
    title: 'Réunion produit Q2',
    teamId: team.id,
    discordVoiceChannelId: voiceChannel.id,
    startedAt: new Date(),
  }
})

// Ajouter une action détectée
await prisma.action.create({
  data: {
    meetingId: meeting.id,
    text: 'Préparer la démo pour vendredi',
    assignee: 'Thomas M.',
    deadline: new Date('2026-05-08'),
    confidence: 0.92,
  }
})

// Récupérer la dernière réunion avec toutes les relations
const lastMeeting = await prisma.meeting.findFirst({
  where: { teamId: team.id },
  orderBy: { startedAt: 'desc' },
  include: { speakers: true, actions: true, blopState: true }
})

// Compter les actions en retard pour une team
const overdueCount = await prisma.action.count({
  where: {
    meeting: { teamId: team.id },
    status: 'pending',
    deadline: { lt: new Date() },
  }
})

// Mettre à jour le statut d'une action
await prisma.action.update({
  where: { id: actionId },
  data: { status: 'done', completedAt: new Date() }
})
```
