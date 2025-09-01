import { REST, Routes } from "discord.js";
import fs from "node:fs";
import path from "node:path";


const commands: any[] = [];
const commandsPath = path.join(process.cwd(), "src/commands");
const commandFiles = fs.readdirSync(commandsPath)
  .filter(file => file.endsWith(".ts"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = (await import(filePath)).default;
  if ("data" in command && "execute" in command) {
    commands.push(command.data.toJSON());
  } else {
    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
  }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN as string);

(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    const data = await rest.put(
      Routes.applicationCommands(
        process.env.CLIENT_ID as string),
      { body: commands },
    );
  } catch (error) {
    console.error(error);
  }
})();
