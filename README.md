# Echidna

Echidna is a multifunctional Discord bot with slash commands, server utilities, and AI chat.

## Self Hosting

You can run Echidna in your own Discord server. Use Node.js 20 or newer.

1. Clone the repository and run `npm install`.
2. Copy `.env.example` to `.env` and fill in the required values. Keep `.env` private.
3. Run `node deploy.js` from the project directory to register slash commands in the configured guild.
4. Run `npm start` to start the bot.

`DISCORD_BOT_TOKEN` is required to run the bot. `CLIENT_ID` and `GUILD_ID` are needed to deploy guild commands. `GOOGLE_AI_STUDIO_API_KEY` enables AI chat. Set `OWNER_ID` for the owner-only reload command, and configure the channel IDs for punishment logs and the honeypot handler as needed.
