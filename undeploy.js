const { REST, Routes } = require("discord.js");
require("dotenv").config({ quiet: true });

const clientId = process.env.CLIENT_ID;

const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
  try {
    console.log("Started removing global application (/) commands.");
    await rest.put(Routes.applicationCommands(clientId), { body: [] });
    console.log("Successfully removed global application (/) commands.");
  } catch (error) {
    console.error(error);
  }
})();
