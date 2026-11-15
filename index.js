import "dotenv/config";
import express from "express";
import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
} from "discord.js";
import { handleMessage } from "./src/message-handler.js";

const required = ["DISCORD_BOT_TOKEN", "GEMINI_API_KEY"];
const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length) {
  console.error("[Startup] Missing required environment variables: " + missing.join(", "));
  process.exit(1);
}

const app = express();
const port = Number(process.env.PORT || 3000);
let discordReady = false;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
  // Echidna is a small community bot and intentionally runs as one shard.
  shards: [0],
  shardCount: 1,
  allowedMentions: { parse: [], repliedUser: false },
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
    status: gatewayStatusNames[shard.status] || "UNKNOWN(" + shard.status + ")",
    ping: shard.ping,
  }));
}

// discord.js normally calls the authenticated /gateway/bot route to discover
// the Gateway URL and shard recommendation. Render's current egress is
// receiving a Cloudflare HTML 429 from that route. Since Echidna is explicitly
// configured for one shard, use Discord's public /gateway route for the URL
// and provide single-shard metadata to discord.js. The Gateway itself still
// enforces Discord's real session and identify limits.
const originalRestGet = client.rest.get.bind(client.rest);
client.rest.get = async (route, options) => {
  if (route === "/gateway/bot") {
    let gatewayUrl = "wss://gateway.discord.gg";
    try {
      const response = await fetch("https://discord.com/api/v10/gateway", {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (response.ok) {
        const data = await response.json();
        if (typeof data.url === "string" && data.url.startsWith("wss://")) {
          gatewayUrl = data.url;
        } else {
          console.warn("[Discord:gateway] Public endpoint returned an unexpected URL; using the documented Gateway fallback.");
        }
      } else {
        console.warn("[Discord:gateway] Public endpoint returned HTTP", response.status, "; using the documented Gateway fallback.");
      }
    } catch (error) {
      console.warn("[Discord:gateway] Public endpoint unavailable:", error?.message || error, "; using the documented Gateway fallback.");
    }

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
  }

  return originalRestGet(route, options);
};

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "echidna",
    discord: discordReady && client.isReady() ? "connected" : "disconnected",
    gateway: gatewaySnapshot(),
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.get("/ready", (_req, res) => {
  const ready = discordReady && client.isReady();
  res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "not_ready",
    service: "echidna",
    discord: ready ? "connected" : "disconnected",
    gateway: gatewaySnapshot(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/", (_req, res) => res.status(200).send("Echidna is running."));

const server = app.listen(port, "0.0.0.0", () => {
  console.log("[HTTP] Health server listening on port " + port);
});

client.once(Events.ClientReady, (readyClient) => {
  discordReady = true;
  console.log("[Discord] READY — logged in as " + readyClient.user.tag);
});

client.on(Events.ShardReady, (shardId) => {
  discordReady = true;
  console.log("[Discord] Gateway shard " + shardId + " ready.");
});

client.on(Events.ShardDisconnect, (closeEvent, shardId) => {
  discordReady = false;
  console.warn("[Discord] Gateway shard " + shardId + " disconnected:", closeEvent?.code, closeEvent?.reason || "");
});

client.on(Events.ShardResume, (shardId, replayedEvents) => {
  discordReady = true;
  console.log("[Discord] Gateway shard " + shardId + " resumed; replayed events:", replayedEvents);
});

client.on(Events.ShardError, (error, shardId) => {
  console.error("[Discord] Gateway shard " + shardId + " error:", error);
});

client.on(Events.Raw, (packet) => {
  if (["READY", "RESUMED", "INVALID_SESSION"].includes(packet?.t)) {
    console.log("[Discord:raw] Gateway dispatch:", packet.t);
  }
});

client.on(Events.Warn, (warning) => console.warn("[Discord] Warning:", warning));

client.on(Events.Debug, (info) => {
  if (/connecting|identify|hello|heartbeat|ready|resume|error|close|invalid|gateway/i.test(info)) {
    console.log("[Discord:debug]", info);
  }
});

client.on(Events.MessageCreate, (message) => {
  void handleMessage(message, client);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === "ping") {
    await interaction.reply("Pong! Echidna is online.");
  }
});

client.on(Events.Error, (error) => console.error("[Discord] Client error:", error));

async function shutdown(signal) {
  console.log("[Process] Received " + signal + "; shutting down.");
  discordReady = false;
  client.destroy();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => console.error("[Process] Unhandled rejection:", reason));
process.on("uncaughtException", (error) => {
  console.error("[Process] Uncaught exception:", error);
  process.exit(1);
});

async function startDiscord() {
  let attempt = 0;
  while (!client.isReady()) {
    try {
      console.log("[Discord] Starting discord.js login; token value hidden.");
      const loginWatchdog = setTimeout(() => {
        console.warn("[Discord] Login is still in progress. Gateway snapshot:", JSON.stringify(gatewaySnapshot()));
      }, 45000);
      loginWatchdog.unref();

      await client.login(process.env.DISCORD_BOT_TOKEN.trim());
      clearTimeout(loginWatchdog);
      console.log("[Discord] Login promise resolved. Gateway snapshot:", JSON.stringify(gatewaySnapshot()));
      return;
    } catch (error) {
      const status = error?.status ?? error?.httpStatus;
      const invalidToken = status === 401 || /tokeninvalid|invalid token/i.test(error?.message || "");
      if (invalidToken) {
        console.error("[Discord] Login rejected. Check DISCORD_BOT_TOKEN in Render; its value is not logged.");
        process.exitCode = 1;
        server.close(() => process.exit(1));
        return;
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
