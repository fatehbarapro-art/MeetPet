import { REST, Routes, SlashCommandBuilder } from 'discord.js'

const commands = [
  new SlashCommandBuilder()
    .setName('meetpet')
    .setDescription('Commandes MeetPet')
    .addSubcommand(sub =>
      sub.setName('start')
        .setDescription('Démarrer une réunion')
        .addStringOption(opt =>
          opt.setName('titre').setDescription('Nom de la réunion').setRequired(false)
        )
    )
    .addSubcommand(sub => sub.setName('stop').setDescription('Terminer la réunion'))
    .addSubcommand(sub => sub.setName('status').setDescription('État de Blop'))
    .addSubcommand(sub => sub.setName('actions').setDescription('Actions en attente')),
]

export async function registerCommands() {
  const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN!)
  await rest.put(
    Routes.applicationGuildCommands(
      process.env.DISCORD_CLIENT_ID!,
      process.env.DISCORD_GUILD_ID!
    ),
    { body: commands.map(c => c.toJSON()) }
  )
  console.log('✅ Slash commands enregistrées')
}
