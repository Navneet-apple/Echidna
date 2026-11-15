# Echidna

Echidna is a personal Discord assistant. She introduces herself as Echidna and helps with the request at hand.

## Self Hosting

You can run Echidna in your own Discord server. Use Node.js 20 or newer.

1. Clone the repository and run `npm install`.
2. Copy `.env.example` to `.env` and fill in the required values. Keep `.env` private.
3. Run `npm start` to start the bot and sync global slash commands in the background. Use `npm run deploy-commands` to sync them manually.

`DISCORD_BOT_TOKEN` and `CLIENT_ID` are required. Set `POLLINATIONS_API_KEY` using a secret key from [Pollinations](https://enter.pollinations.ai) to enable AI chat. `POLLINATIONS_MODEL` is optional; it defaults to `openai/gpt-5.4-nano`. Pollinations API usage consumes Pollen credits. Echidna can respond to direct messages, messages that mention her in a server, and `/ask` commands.
