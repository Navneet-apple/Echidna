// Pollinations OpenAI-compatible chat API.
const POLLINATIONS_API_URL = "https://gen.pollinations.ai/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-5.4-nano";

// System Instruction

const systemInstruction = `Your name is Echidna. You are a personal assistant. Be friendly, thoughtful, and concise. Help with the request at hand without claiming a specialized background or inventing personal details. If you are unsure or need more context, say so and ask a simple follow-up question. Keep replies under 1800 characters. Never output Discord mass-mention tokens such as @everyone or @here.`;

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

    const apiKey = process.env.POLLINATIONS_API_KEY?.trim();
    if (!apiKey) {
      await message.reply(
        "My AI service isn't configured yet. Please ask my owner to add a Pollinations API key.",
      );
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
      const response = await fetch(POLLINATIONS_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.POLLINATIONS_MODEL?.trim() || DEFAULT_MODEL,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: userContent },
          ],
          max_tokens: 1200,
        }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = data?.error?.message || data?.error || `HTTP ${response.status}`;
        const apiError = new Error(`Pollinations API error (${response.status}): ${detail}`);
        apiError.status = response.status;
        throw apiError;
      }
      console.log("[AI] Pollinations response received.");

      const footer =
        "\n\n-# Powered by Echidna AI" +
        "\n-# AI can make mistakes.";

      // Format response
      const replyText = data?.choices?.[0]?.message?.content || "";
      const maxLength = Math.min(1800, 2000 - footer.length);

      const safeText =
        replyText.length > maxLength
          ? `${replyText.slice(0, maxLength - 3)}...`
          : replyText;

      await message.reply({
        content: `${safeText || "No response generated."}${footer}`,
      });
      console.log("[AI] Reply sent.");
    } catch (error) {
      console.error("[AI] Pollinations request failed:", error);

      const invalidApiKey = error?.status === 401;
      const quotaExceeded = error?.status === 402 || error?.status === 429;
      const errorMessage = invalidApiKey
        ? "I can't reach my AI service right now. Please ask my owner to check the Pollinations API key."
        : quotaExceeded
          ? "I'm temporarily out of AI credits or capacity. Please try again later."
          : "I couldn't complete that request just now. Please try again in a moment.";

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
