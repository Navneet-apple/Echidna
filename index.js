// Core codes

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
} = require("discord.js");
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageTyping,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
  allowedMentions: {
    parse: ["users", "roles"],
    repliedUser: true,
  },
});
require("dotenv").config({
  path: path.resolve(__dirname, ".env"),
  quiet: true,
});

const port = Number(process.env.PORT || 10000);
const pingServer = http.createServer((request, response) => {
  if (request.method === "GET" && request.url === "/ping") {
    response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("OK");
    return;
  }

  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not Found");
});

pingServer.listen(port, "0.0.0.0", () => {
  console.log(`[HTTP] Ping server listening on port ${port}`);
});

const renderExternalUrl = process.env.RENDER_EXTERNAL_URL?.trim().replace(/\/+$/, "");
if (renderExternalUrl) {
  const selfPing = async () => {
    try {
      const response = await fetch(`${renderExternalUrl}/ping`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        console.warn(`[HTTP] Render self-ping returned HTTP ${response.status}`);
      }
    } catch (error) {
      console.warn("[HTTP] Render self-ping failed:", error?.message || error);
    }
  };

  const timer = setInterval(() => void selfPing(), 14 * 60 * 1000);
  timer.unref();
  void selfPing();
}

// Commands Handler

client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  // Set a new item in the Collection with the key as the command name and the value as the exported module
  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.log(
      `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
    );
  }
}

// Messages Handler

client.messages = new Collection();

const messagesPath = path.join(__dirname, "messages");
const messageFiles = fs
  .readdirSync(messagesPath)
  .filter((file) => file.endsWith(".js"));

for (const file of messageFiles) {
  const filePath = path.join(messagesPath, file);
  const handler = require(filePath);

  if (
    typeof handler.match === "function" &&
    typeof handler.execute === "function"
  ) {
    client.messages.set(file, handler);
  } else {
    console.warn(
      `[WARNING] The message handler at ${filePath} is missing a required "match" or "execute" function.`,
    );
  }
}

// Events Handler

const eventsPath = path.join(__dirname, "events");
const eventFiles = fs
  .readdirSync(eventsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

console.log("Ready event listeners:", {
  ready: client.listenerCount("ready"),
  clientReady: client.listenerCount("clientReady"),
});

client.login(process.env.DISCORD_BOT_TOKEN);
