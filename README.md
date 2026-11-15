# Echidna

**An open-source Discord community assistant powered by Google Gemini 4 Hydrogen.**

Echidna is a standalone Discord bot adapted from the architecture and ideas of [realmeme-superfart-rebooted](https://github.com/raymond-1227/realmeme-superfart-rebooted). It is maintained separately from Zangetsu.

## Features

- Responds only when a user directly mentions Echidna or replies to one of Echidna's messages.
- Uses Google's Gemini API with the \`gemini-4-hydrogen\` model by default.
- Keeps a short, in-memory conversation history per channel.
- Includes an HTTP health endpoint for Render and external uptime monitors.
- Handles Discord reconnects and shuts down cleanly.
- Includes a slash-command deployment script.

## Requirements

- Node.js 22 or newer
- A Discord application and bot token
- A Gemini API key with access to Gemini 4 Hydrogen

## Local setup

1. Clone this repository and install dependencies:

   \`\`\`bash
   git clone https://github.com/Navneet-apple/Echidna.git
   cd Echidna
   npm install
   \`\`\`

2. Copy \`.env.example\` to \`.env\` and fill in the values:

   | Variable | Required | Description |
   |---|---|---|
   | \`DISCORD_BOT_TOKEN\` | Yes | Discord bot token |
   | \`GEMINI_API_KEY\` | Yes | Google Gemini API key |
   | \`GEMINI_MODEL\` | No | Defaults to \`gemini-4-hydrogen\` |
   | \`GEMINI_TIMEOUT_MS\` | No | Gemini request timeout in milliseconds; defaults to \`60000\` (allowed: 1000–180000) |
   | \`PORT\` | No | HTTP port; defaults to \`3000\` |
   | \`DISCORD_CLIENT_ID\` | For slash commands | Discord application ID |
   | \`DISCORD_GUILD_ID\` | Optional | Guild ID for fast guild-scoped command registration |
   | \`BOT_SYSTEM_PROMPT\` | No | Optional assistant instruction |

3. In the Discord Developer Portal, enable the **Message Content Intent**. Invite the bot with permission to view channels and send messages. Never publish your bot token or API key.

4. Start Echidna:

   \`\`\`bash
   npm start
   \`\`\`

5. Register the included slash command:

   \`\`\`bash
   npm run deploy-commands
   \`\`\`

## Message trigger behavior

Echidna ignores ordinary channel messages. It responds only when:
- A message directly mentions the bot, or
- A message is a reply to a message authored by Echidna.

Messages from bots and webhooks are ignored. The bot mention is removed before the text is sent to Gemini.

## Deploy on Render Free

1. Push this repository to GitHub.
2. In Render, create a **Web Service** and connect this repository.
3. Use Node runtime, build command \`npm install\`, and start command \`npm start\`.
4. Add \`DISCORD_BOT_TOKEN\` and \`GEMINI_API_KEY\` in Render's Environment settings.
5. Set the health check path to \`/health\` (also configured in \`render.yaml\`).

Never commit \`.env\`, tokens, or API keys. Use Render environment variables for secrets.

### Render Free sleep and uptime limitations

Render Free web services spin down after 15 minutes without inbound traffic. A request can wake a sleeping service, but waking may take around a minute. Free instances also have a monthly instance-hour allowance and ephemeral filesystems. Therefore:

- Echidna is **not guaranteed to stay connected to Discord 24/7** on Render Free.
- While the service sleeps, its Discord Gateway connection closes and the bot appears offline until Render starts it again.
- An external monitor checking \`/health\` every five minutes can detect downtime and may wake a sleeping service. It does **not** guarantee continuous availability or override Render's free-tier sleep policy.
- Conversation history is held in memory and is lost when the process restarts.
- For reliable always-on Discord operation, use an always-on paid service.

### Uptime monitoring

Create an HTTP monitor with your preferred monitoring provider:

- URL: \`https://YOUR-RENDER-SERVICE.onrender.com/health\`
- Method: \`GET\`
- Interval: 5 minutes
- Expected status: \`200\`

Use `/health` for Render's health check; it returns HTTP 200 while the web process is serving. Use `/ready` for external alerts; it returns HTTP 503 when Discord is disconnected. Configure your monitor to check `/ready` every five minutes and send downtime notifications.

## Project structure

\`\`\`text
Echidna/
├── src/
│   ├── ai.js
│   └── message-handler.js
├── .env.example
├── .gitignore
├── index.js
├── package.json
├── render.yaml
└── deploy-commands.js
\`\`\`

## Troubleshooting

- **Bot never responds:** Confirm Message Content Intent is enabled and the bot can view the channel.
- **Bot responds to every message:** Confirm the latest version is deployed; the message handler filters ordinary messages.
- **Gemini authentication error:** Verify \`GEMINI_API_KEY\` in Render or \`.env\`.
- **Model unavailable:** Confirm that the API key and API surface have access to \`gemini-4-hydrogen\`.
- **Bot goes offline:** Check Render logs and the free-tier sleep behavior.

## License and attribution

Echidna is released under the MIT License. Its initial design is based on and adapted from [raymond-1227/realmeme-superfart-rebooted](https://github.com/raymond-1227/realmeme-superfart-rebooted), which is also MIT-licensed. The original copyright and license notice are retained in [LICENSE](LICENSE).

## Links

- [Source inspiration](https://github.com/raymond-1227/realmeme-superfart-rebooted)
- [Gemini API documentation](https://ai.google.dev/gemini-api/docs)
- [Gemini 4 Hydrogen model documentation](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/4-hydrogen)
- [Render Free documentation](https://render.com/docs/free)
