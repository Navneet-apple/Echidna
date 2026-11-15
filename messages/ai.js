const {
  SYSTEM_INSTRUCTION,
  formatReply,
  generateCompletion,
  getUserFacingError,
} = require("../src/pollinations");

// Helpers

function removeBotMention(content, botId) {
  return content.replace(new RegExp(`<@!?${botId}>`, "g"), "").trim();
}

async function urlToDataUrl(url, mimeType) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });

  if (!response.ok) {
    throw new Error(`Failed to fetch image from URL: ${url}`);
  }

  const arrayBuffer = await response.arrayBuffer();

  return `data:${mimeType};base64,${Buffer.from(arrayBuffer).toString("base64")}`;
}
// Message Handler

module.exports = {
  match(message) {
    return message.inGuild()
      ? message.mentions.has(message.client.user)
      : true;
  },

  async execute(message) {
    const botId = message.client.user.id;
    const question = removeBotMention(message.content, botId);

    const imageAttachments = message.attachments.filter((attachment) =>
      attachment.contentType?.startsWith("image/"),
    );

    const showTyping = () =>
      message.channel.sendTyping().catch((error) => {
        console.warn("[AI] Could not send typing indicator:", error?.message || error);
      });

    // Help responder
    if (!question && imageAttachments.size === 0) {
      await showTyping();

      await message.reply({
        embeds: [
          {
            color: 0xffc916,
            title: "Need Command Help?",
            description:
              "Type `/` in the message box and select my avatar on the sidebar to check all my available commands!",
            fields: [
              {
                name: "Pro Tip",
                value:
                  "Ping the bot with a question for a quick answer from the AI!",
              },
              {
                name: "Note",
                value: "You can message me here or mention me in a server.",
              },
            ],
          },
        ],
      });

      return;
    }

    // AI responder
    void showTyping();
    const typingInterval = setInterval(() => void showTyping(), 7000);

    try {
      const messageParts = [];

      // Referenced message context
      if (message.reference?.messageId) {
        try {
          const referencedMessage = await message.channel.messages.fetch(
            message.reference.messageId,
          );

          if (referencedMessage.content) {
            const cleanRefContent = removeBotMention(
              referencedMessage.content,
              botId,
            );

            if (cleanRefContent) {
              messageParts.push({
                type: "text",
                text: `Context (The message you are replying to):\n"${cleanRefContent}"\n\n---`,
              });
            }
          }
        } catch (error) {
          console.error("Failed to fetch referenced message:", error);
        }
      }

      // User question
      if (question) {
        messageParts.push({ type: "text", text: question });
      }

      // Image attachments
      for (const [index, attachment] of [
        ...imageAttachments.values(),
      ].entries()) {
        messageParts.push({ type: "text", text: `Image ${index + 1}:` });
        messageParts.push({
          type: "image_url",
          image_url: {
            url: await urlToDataUrl(attachment.url, attachment.contentType),
          },
        });
      }

      const userContent = messageParts.some((part) => part.type === "image_url")
        ? messageParts
        : messageParts.map((part) => part.text).join("\n\n");

      console.log("[AI] Generating response with Pollinations.");
      const replyText = await generateCompletion([
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: userContent },
      ]);
      console.log("[AI] Pollinations response received.");

      await message.reply({
        content: formatReply(replyText),
      });
      console.log("[AI] Reply sent.");
    } catch (error) {
      console.error("[AI] Pollinations request failed:", error);

      const errorMessage = getUserFacingError(error);

      try {
        await message.reply({ content: errorMessage });
        console.log("[AI] Error reply sent.");
      } catch (replyError) {
        console.error("[AI] Could not send error reply:", replyError);
        await message.channel.send(errorMessage).then(() => {
          console.log("[AI] Error message sent to channel.");
        }).catch((sendError) => {
          console.error("[AI] Could not send error message to channel:", sendError);
        });
      }
    } finally {
      clearInterval(typingInterval);
    }
  },
};
