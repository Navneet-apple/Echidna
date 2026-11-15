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
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error("Missing required environment variables: " + missing.join(", "));
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
  allowedMentions: {
    parse: [],
    repliedUser: false,
  },
});

app.get("/", (_req, res) => {
  res.status(200).send("Echidna is running.");
});

app.get("/health", (_req, res) => {
  const healthy = discordReady && client.isReady();
  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    service: "echidna",
    discord: healthy ? "connected" : "disconnected",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

const server = app.listen(port, "0.0.0.0", () => {
  console.log("[HTTP] Health server listening on port " + port);
});

client.once(Events.ClientReady, (readyClient) => {
  discordReady = true;
  console.log("[Discord] Logged in as " + readyClient.user.tag);
});

client.on(Events.ShardDisconnect, () => {
  discordReady = false;
  console.warn("[Discord] Gateway disconnected.");
});

client.on(Events.ShardResume, () => {
  discordReady = true;
  console.log("[Discord] Gateway session resumed.");
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

client.on(Events.Error, (error) => {
  console.error("[Discord] Client error:", error);
});

async function shutdown(signal) {
  console.log("[Process] Received " + signal + "; shutting down.");
  discordReady = false;
  client.destroy();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

client.login(process.env.DISCORD_BOT_TOKEN).catch((error) => {
  console.error("[Discord] Login failed:", error);
  process.exit(1);
});
