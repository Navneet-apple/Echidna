const API_URL = "https://gen.pollinations.ai/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-5.4-nano";
const SYSTEM_INSTRUCTION = `Your name is Echidna. You are a personal assistant. Be friendly, thoughtful, and concise. Help with the request at hand without claiming a specialized background or inventing personal details. If you are unsure or need more context, say so and ask a simple follow-up question. Keep replies under 1800 characters. Never output Discord mass-mention tokens such as @everyone or @here.`;

function getModelName() {
  return process.env.POLLINATIONS_MODEL?.trim() || DEFAULT_MODEL;
}

async function generateCompletion(messages) {
  const apiKey = process.env.POLLINATIONS_API_KEY?.trim();
  if (!apiKey) {
    const error = new Error("POLLINATIONS_API_KEY is not configured.");
    error.code = "MISSING_API_KEY";
    throw error;
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getModelName(),
      messages,
      max_tokens: 1200,
    }),
    signal: AbortSignal.timeout(30000),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.error?.message || data?.error || `HTTP ${response.status}`;
    const error = new Error(`Pollinations API error (${response.status}): ${detail}`);
    error.status = response.status;
    throw error;
  }

  const content = data?.choices?.[0]?.message?.content;
  const text = typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.filter((part) => typeof part?.text === "string").map((part) => part.text).join("\n")
      : "";

  if (!text.trim()) {
    throw new Error("Pollinations returned an empty response.");
  }

  return text.trim();
}

function formatReply(text) {
  const footer = `\n\n-# Powered by ${getModelName()}\n-# AI can make mistakes.`;
  const maxLength = 2000 - footer.length;
  const safeText = text.length > maxLength
    ? `${text.slice(0, maxLength - 3)}...`
    : text;
  return `${safeText}${footer}`;
}

function getUserFacingError(error) {
  if (error?.code === "MISSING_API_KEY" || error?.status === 401) {
    return "I can't reach my AI service right now. Please ask my owner to check the Pollinations API key.";
  }
  if (error?.status === 402 || error?.status === 429) {
    return "I'm temporarily out of AI credits or capacity. Please try again later.";
  }
  return "I couldn't complete that request just now. Please try again in a moment.";
}

module.exports = {
  SYSTEM_INSTRUCTION,
  formatReply,
  generateCompletion,
  getModelName,
  getUserFacingError,
};
