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
// Render can have higher or more variable outbound latency than a local
// Termux connection. Keep the library's normal timeout and retry behavior.
const DISCORD_REST_OPTIONS = {
  timeout: 15_000,
  retries: 3,
};
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageTyping,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel],
  rest: DISCORD_REST_OPTIONS,
  // This personal assistant uses a single Gateway shard.
  shards: [0],
  shardCount: 1,
  allowedMentions: {
    parse: ["users", "roles"],
    repliedUser: true,
  },
});

function logRestIssues(rest, label) {
  rest.on("rateLimited", ({ global, retryAfter, scope, method }) => {
    console.warn(
      `[Discord:REST:${label}] Rate limited; method=${method}, scope=${scope}, global=${global}, retryAfterMs=${retryAfter}`,
    );
  });
  rest.on("response", (_request, response) => {
    if (response.status >= 400) {
      const retryAfter = response.headers?.get?.("retry-after") || "unknown";
      const scope = response.headers?.get?.("x-ratelimit-scope") || "unknown";
      const global = response.headers?.get?.("x-ratelimit-global") || "unknown";
      const cfMitigated = response.headers?.get?.("cf-mitigated") || "none";
      console.warn(
        `[Discord:REST:${label}] HTTP ${response.status}; retryAfter=${retryAfter}, scope=${scope}, global=${global}, cfMitigated=${cfMitigated}.`,
      );
    }
  });
}

logRestIssues(client.rest, "bot");
require("dotenv").config({
  path: path.resolve(__dirname, ".env"),
  quiet: true,
});

console.log("[AI] Pollinations API key configured:", Boolean(process.env.POLLINATIONS_API_KEY?.trim()));

if (!process.env.DISCORD_BOT_TOKEN?.trim()) {
  console.error("[Startup] Missing required environment variable: DISCORD_BOT_TOKEN");
  process.exit(1);
}

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

// Discord's HTTP API is returning 429 responses to this Render service.
// Avoid an extra HTTP lookup and use the documented Gateway URL directly.
const originalRestGet = client.rest.get.bind(client.rest);
client.rest.get = async (route, options) => {
  if (route !== "/gateway/bot") return originalRestGet(route, options);

  const gatewayUrl = "wss://gateway.discord.gg";
  console.log("[Discord:gateway] Using single-shard Gateway URL:", gatewayUrl);
  return {
    url: gatewayUrl,
    shards: 1,
    session_start_limit: {
      total: 1,
      remaining: 1,
      reset_after: 5000,
      max_concurrency: 1,
    },
  };
};

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
  const listener = (...args) => {
    Promise.resolve().then(() => event.execute(...args)).catch((error) => {
      console.error(`[Event:${event.name}] Handler failed:`, error);
    });
  };

  if (event.once) client.once(event.name, listener);
  else client.on(event.name, listener);
}

console.log("[Startup] Loaded commands:", [...client.commands.keys()].join(", ") || "none");
console.log("[Startup] Loaded message handlers:", [...client.messages.keys()].join(", ") || "none");
console.log("[Startup] Discord listeners:", {
  clientReady: client.listenerCount("clientReady"),
  messageCreate: client.listenerCount("messageCreate"),
  interactionCreate: client.listenerCount("interactionCreate"),
  guildMessagesIntent: client.options.intents.has(GatewayIntentBits.GuildMessages),
  messageContentIntent: client.options.intents.has(GatewayIntentBits.MessageContent),
  directMessagesIntent: client.options.intents.has(GatewayIntentBits.DirectMessages),
});

client.on("raw", (packet) => {
  if (packet.t === "INTERACTION_CREATE") {
    console.log(
      `[Discord:raw] INTERACTION_CREATE received; command=${packet.d?.data?.name || "unknown"}.`,
    );
    return;
  }

  if (packet.t !== "MESSAGE_CREATE") return;
  const data = packet.d;
  if (data?.author?.bot) return;

  const inGuild = Boolean(data?.guild_id);
  const botMentioned = data?.mentions?.some((user) => user.id === client.user?.id) ?? false;
  if (!inGuild || botMentioned) {
    console.log(
      `[Discord:raw] MESSAGE_CREATE received; type=${inGuild ? "guild" : "DM"}; botMentioned=${botMentioned}.`,
    );
  }
});

const gatewayStatusNames = {
  0: "READY",
  1: "CONNECTING",
  2: "RECONNECTING",
  3: "IDLE",
  4: "NEARLY",
  5: "DISCONNECTED",
  6: "WAITING_FOR_GUILDS",
  7: "IDENTIFYING",
  8: "RESUMING",
};

function gatewaySnapshot() {
  return [...client.ws.shards.values()].map((shard) => ({
    id: shard.id,
    status: gatewayStatusNames[shard.status] || `UNKNOWN(${shard.status})`,
    ping: shard.ping,
  }));
}

client.on("shardError", (error, shardId) => {
  console.error(`[Discord] Gateway shard ${shardId} error:`, error);
});

client.on("shardDisconnect", (closeEvent, shardId) => {
  console.warn(`[Discord] Gateway shard ${shardId} disconnected:`, closeEvent?.code, closeEvent?.reason || "");
});

async function startDiscord() {
  let attempt = 0;
  while (!client.isReady()) {
    let loginWatchdog;
    try {
      console.log("[Discord] Starting login; token value hidden.");
      loginWatchdog = setTimeout(() => {
        console.warn("[Discord] Login is still in progress. Gateway snapshot:", JSON.stringify(gatewaySnapshot()));
      }, 45000);
      loginWatchdog.unref();

      await client.login(process.env.DISCORD_BOT_TOKEN.trim());
      clearTimeout(loginWatchdog);
      console.log("[Discord] Login promise resolved. Gateway snapshot:", JSON.stringify(gatewaySnapshot()));
      return;
    } catch (error) {
      clearTimeout(loginWatchdog);
      const status = error?.status ?? error?.httpStatus;
      if (status === 401 || /tokeninvalid|invalid token/i.test(error?.message || "")) {
        console.error("[Discord] Login rejected. Check DISCORD_BOT_TOKEN in Render; its value is not logged.");
        process.exit(1);
      }

      attempt += 1;
      const delayMs = Math.min(30000 * 2 ** Math.min(attempt - 1, 4), 300000);
      console.error("[Discord] Login attempt failed:", error?.stack || error);
      console.warn("[Discord] Retrying Gateway login in", Math.round(delayMs / 1000), "seconds.");
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

void startDiscord().catch((error) => {
  console.error("[Discord:startup] Discord startup aborted:", error?.message || error);
  process.exit(1);
});
