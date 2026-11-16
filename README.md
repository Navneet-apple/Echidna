# Echidna

Echidna is a personal Discord assistant. She introduces herself as Echidna and helps with the request at hand.

## Self Hosting

You can run Echidna in your own Discord server. Use Node.js 20 or newer.

1. Clone the repository and run `npm install`.
2. Copy `.env.example` to `.env` and fill in the required values. Keep `.env` private.
3. Run `npm start` to start the bot. Run `npm run deploy-commands` once to sync global slash commands, and again when you add or change commands.

`DISCORD_BOT_TOKEN` is required to run the bot. `CLIENT_ID` is required by the command deployment script. Set `POLLINATIONS_API_KEY` using a secret key from [Pollinations](https://enter.pollinations.ai) to enable AI chat. `POLLINATIONS_MODEL` is optional; it defaults to `openai/gpt-5.4-nano`. Pollinations API usage consumes Pollen credits. Echidna can respond to direct messages, messages that mention her in a server, and `/ask` commands.

## Deploying on Render

This repository includes a `render.yaml` Blueprint for a Node web service. Create a Blueprint from this repository, then set `DISCORD_BOT_TOKEN` in the Render service environment. `POLLINATIONS_API_KEY` is needed for AI responses. Render supplies `PORT`; the service listens on `0.0.0.0` and exposes `/ping` for its health check. Set `CLIENT_ID` when you run `npm run deploy-commands`; the bot no longer republishes commands on each restart.

For a free Render service, configure the GitHub Actions variable `RENDER_EXTERNAL_URL` to the service URL (for example, `https://echidna.onrender.com`) or add it as a repository secret. The workflow in `.github/workflows/render-keepalive.yml` pings `/ping` every 14 minutes. Free services can still sleep if those pings stop, and Render may restart them; use a paid always-on service for reliable 24/7 bot availability.

Use Node.js 20 or newer. If deployment fails, check Render's deploy and runtime logs for the first `[Startup]`, `[Discord:gateway]`, or `[Discord]` error; the Discord token must belong to the bot application, and `CLIENT_ID` must be that application's ID.
