import {
  Client,
  Collection,
  GatewayIntentBits,
  Events,
  SlashCommandBuilder,
  MessageFlags,
  type ClientOptions
}
  from "discord.js";

import { initDb } from "./db";
import fs from "node:fs";
import path from "node:path";

initDb();

interface Command {
  data: SlashCommandBuilder;
  execute: (...args: any[]) => Promise<void>;

}

export class ExtendedClient extends Client {
  public commands: Collection<string, Command>;

  constructor(options: ClientOptions) {
    super(options);
    this.commands = new Collection();
  }
}

const client = new ExtendedClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const commandsPath = path.join(import.meta.dir, "commands");
console.log(commandsPath);
const commandFiles = fs.readdirSync(commandsPath)
  .filter(file => file.endsWith(".ts"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = (await import(filePath)).default;
  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command)
  } else {
    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
  }
}


client.once(Events.ClientReady, readyClient => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
})

// client.on("messageCreate", (message) => {
//   if (message.author.bot) return;
//   console.log(message.createdAt);
//   message.reply(`${message.createdAt}`);
// })

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
    }
  }
})

client.login(process.env.DISCORD_TOKEN);

