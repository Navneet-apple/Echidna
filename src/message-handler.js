import { generateReply } from "./ai.js";

const MAX_HISTORY_MESSAGES = 12;
const histories = new Map();

function getHistory(key) {
  if (!histories.has(key)) histories.set(key, []);
  return histories.get(key);
}

function trimHistory(history) {
  while (history.length > MAX_HISTORY_MESSAGES) history.shift();
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

  console.log("[Message] Trigger accepted; preparing Gemini request.");
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

  const history = getHistory(message.channelId);
  await message.channel.sendTyping().catch(() => {});

  try {
    const response = await generateReply(history, cleaned);
    console.log("[AI] Gemini response generated; characters:", response.length);
    history.push({ role: "user", text: cleaned });
    history.push({ role: "model", text: response });
    trimHistory(history);

    const chunks = response.match(/[\s\S]{1,1900}/g) || ["I couldn't produce a response."];
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
    console.error("[AI] Response failed:", error?.stack || error);
    await message.reply({
      content: "I'm unable to reach the AI service right now. Please try again shortly.",
      allowedMentions: { repliedUser: false },
    }).catch((replyError) => {
      console.error("[Discord] Could not send error reply:", replyError);
    });
  }
}
