import { generateReply } from "./ai.js";

const MAX_HISTORY_MESSAGES = 12;
const histories = new Map();
const channelQueues = new Map();

function getHistory(key) {
  if (!histories.has(key)) histories.set(key, []);
  return histories.get(key);
}

function trimHistory(history) {
  while (history.length > MAX_HISTORY_MESSAGES) history.shift();
}

async function processAcceptedMessage(message, client, cleaned) {
  const history = getHistory(message.channelId);
  await message.channel.sendTyping().catch(() => {});
  const startedAt = Date.now();

  try {
    console.log("[AI] Gemini request started; history messages:", history.length);
    const response = await generateReply(history, cleaned);
    console.log("[AI] Gemini response generated; characters:", response.length, "durationMs:", Date.now() - startedAt);

    history.push({ role: "user", text: cleaned });
    history.push({ role: "model", text: response });
    trimHistory(history);

    const chunks = response.match(/[\\s\\S]{1,1900}/g) || ["I couldn't produce a response."];
    await message.reply({
      content: chunks[0],
      allowedMentions: { repliedUser: false },
    });

    for (const chunk of chunks.slice(1)) {
      await message.channel.send({
        content: chunk,
        allowedMentions: { parse: [] },
      });
    }
  } catch (error) {
    const timedOut = ["AbortError", "TimeoutError"].includes(error?.name) ||
      /timed? ?out|aborted/i.test(error?.message || "");
    console.error("[AI] Response failed after", Date.now() - startedAt, "ms:", error?.stack || error);
    await message.reply({
      content: timedOut
        ? "Gemini is taking too long to respond. Please try again in a moment."
        : "I'm unable to reach the AI service right now. Please try again shortly.",
      allowedMentions: { repliedUser: false },
    }).catch((replyError) => {
      console.error("[Discord] Could not send error reply:", replyError);
    });
  }
}

export async function handleMessage(message, client) {
  if (!message || message.author?.bot || message.webhookId) return;
  if (!client.user) {
    console.warn("[Message] Ignored message because the Discord client is not ready.");
    return;
  }

  const directlyMentioned = message.mentions.users.has(client.user.id);
  let isReplyToBot = false;

  if (message.reference?.messageId) {
    try {
      const referenced = await message.fetchReference();
      isReplyToBot = referenced.author?.id === client.user.id;
    } catch {
      // Deleted or inaccessible referenced messages are not valid bot replies.
    }
  }

  console.log("[Message] Received user message:", JSON.stringify({
    guildId: message.guildId,
    channelId: message.channelId,
    messageId: message.id,
    directlyMentioned,
    isReplyToBot,
    contentLength: message.content?.length ?? 0,
  }));

  if (!directlyMentioned && !isReplyToBot) return;

  const cleaned = message.content
    .replaceAll("<@" + client.user.id + ">", "")
    .replaceAll("<@!" + client.user.id + ">", "")
    .trim();

  if (!cleaned) {
    await message.reply({
      content: "Mention me with a question, or reply to one of my messages.",
      allowedMentions: { repliedUser: false },
    });
    return;
  }

  // Keep each channel's requests in order so rapid messages cannot race
  // against one another while reading and updating conversation history.
  const channelId = message.channelId;
  const previous = channelQueues.get(channelId) || Promise.resolve();
  const current = previous
    .catch(() => {})
    .then(() => processAcceptedMessage(message, client, cleaned));

  channelQueues.set(channelId, current);
  try {
    await current;
  } finally {
    if (channelQueues.get(channelId) === current) {
      channelQueues.delete(channelId);
    }
  }
}
