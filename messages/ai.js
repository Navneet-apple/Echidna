// Gemini AI Message Handler

const { GoogleGenAI, ThinkingLevel } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_AI_STUDIO_API_KEY,
  httpOptions: {
    apiVersion: "v1beta",
    timeout: 30000,
    retryOptions: {
      attempts: 3,
      initialDelay: 1,
      maxDelay: 4,
      expBase: 2,
      jitter: 1,
      httpStatusCodes: [500, 502, 503, 504],
    },
  },
});

// System Instruction

const systemInstruction = `Your name is Echidna. You are a personal assistant. Be friendly, thoughtful, and concise. Help with the request at hand without claiming a specialized background or inventing personal details. If you are unsure or need more context, say so and ask a simple follow-up question. Keep replies under 1800 characters. Never output Discord mass-mention tokens such as @everyone or @here.`;

// Helpers

function removeBotMention(content, botId) {
  return content.replace(new RegExp(`<@!?${botId}>`, "g"), "").trim();
}

async function urlToGenerativePart(url, mimeType) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch image from URL: ${url}`);
  }

  const arrayBuffer = await response.arrayBuffer();

  return {
    inlineData: {
      data: Buffer.from(arrayBuffer).toString("base64"),
      mimeType,
    },
  };
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
        messageParts.push({ text: question });
      }

      // Image attachments
      for (const [index, attachment] of [
        ...imageAttachments.values(),
      ].entries()) {
        messageParts.push({
          text: `Image ${index + 1}:`,
        });

        messageParts.push(
          await urlToGenerativePart(attachment.url, attachment.contentType),
        );
      }

      // Generate AI response
      console.log("[AI] Generating response.");
      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: [
          {
            role: "user",
            parts: messageParts,
          },
        ],
        config: {
          systemInstruction,
          tools: [{ googleSearch: {} }],
          maxOutputTokens: 3600,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      });
      console.log("[AI] Response generated.");

      // Check Google Search usage
      const usedSearch =
        (response.candidates?.[0]?.groundingMetadata?.groundingChunks?.length ??
          0) > 0;

      const searchStatus = usedSearch ? " with Google Search" : "";

      const footer =
        `\n\n-# Powered by Echidna AI${searchStatus}` +
        "\n-# Gemini is AI and can make mistakes.";

      // Format response
      const replyText = response.text || "";
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
      console.error("AI Generation Error:", error);

      const invalidApiKey =
        error?.status === 400 && /api.?key|api_key/i.test(error?.message || "");

      await message.reply({
        content: invalidApiKey
          ? "I can't reach my AI service right now. Please ask my owner to check the Google AI API key."
          : "I couldn't complete that request just now. Please try again in a moment.",
      }).catch((replyError) => {
        console.error("[AI] Could not send error reply:", replyError);
      });
    } finally {
      clearInterval(typingInterval);
    }
  },
};
