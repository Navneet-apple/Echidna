import "dotenv/config";
import { REST, Routes, SlashCommandBuilder } from "discord.js";

const { DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } = process.env;
if (!DISCORD_BOT_TOKEN || !DISCORD_CLIENT_ID) {
  throw new Error("Set DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID before deploying commands.");
}

const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check whether Echidna is responding."),
].map((command) => command.toJSON());

const rest = new REST({ version: "10" }).setToken(DISCORD_BOT_TOKEN);
const route = DISCORD_GUILD_ID
  ? Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID)
  : Routes.applicationCommands(DISCORD_CLIENT_ID);

await rest.put(route, { body: commands });
console.log("Registered " + commands.length + " slash command(s).");
