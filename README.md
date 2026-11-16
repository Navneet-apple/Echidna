# Echidna

Echidna is a personal Discord assistant. She introduces herself as Echidna and helps with the request at hand.

## Self Hosting

You can run Echidna in your own Discord server. Use Node.js 20 or newer.

1. Clone the repository and run `npm install`.
2. Copy `.env.example` to `.env` and fill in the required values. Keep `.env` private.
3. Run `npm start` to start the bot and sync global slash commands in the background. Use `npm run deploy-commands` to sync them manually.

`DISCORD_BOT_TOKEN` and `CLIENT_ID` are required. Set `POLLINATIONS_API_KEY` using a secret key from [Pollinations](https://enter.pollinations.ai) to enable AI chat. `POLLINATIONS_MODEL` is optional; it defaults to `openai/gpt-5.4-nano`. Pollinations API usage consumes Pollen credits. Echidna can respond to direct messages, messages that mention her in a server, and `/ask` commands.

## Deploying on Render

This repository includes a `render.yaml` Blueprint for a Node web service. Create a Blueprint from this repository, then set `DISCORD_BOT_TOKEN` and `CLIENT_ID` in the Render service environment. `POLLINATIONS_API_KEY` is needed for AI responses. Render supplies `PORT`; the service listens on `0.0.0.0` and exposes `/ping` for its health check.

For a free Render service, configure the GitHub Actions variable `RENDER_EXTERNAL_URL` to the service URL (for example, `https://echidna.onrender.com`) or add it as a repository secret. The workflow in `.github/workflows/render-keepalive.yml` pings `/ping` every 14 minutes. Free services can still sleep if those pings stop, and Render may restart them; use a paid always-on service for reliable 24/7 bot availability.

Use Node.js 20 or newer. If deployment fails, check Render's deploy and runtime logs for the first `[Startup]`, `[Discord:gateway]`, or `[Discord]` error; the Discord token must belong to the bot application, and `CLIENT_ID` must be that application's ID.
