# Echidna

Echidna is a personal Discord assistant. She introduces herself as Echidna and helps with the request at hand.

## Self Hosting

You can run Echidna in your own Discord server. Use Node.js 20 or newer.

1. Clone the repository and run `npm install`.
2. Copy `.env.example` to `.env` and fill in the required values. Keep `.env` private.
3. Run `node deploy.js` from the project directory to register the assistant's global slash commands.
4. Run `npm start` to start the bot.

`DISCORD_BOT_TOKEN` and `CLIENT_ID` are required. Set `POLLINATIONS_API_KEY` using a secret key from [Pollinations](https://enter.pollinations.ai) to enable AI chat. `POLLINATIONS_MODEL` is optional; it defaults to `openai/gpt-5.4-nano`. Pollinations API usage consumes Pollen credits. Echidna can respond to direct messages and to messages that mention her in a server.
