import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("Missing GEMINI_API_KEY environment variable.");
}

const requestTimeoutMs = Number(process.env.GEMINI_TIMEOUT_MS || 60000);
if (!Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs < 1000 || requestTimeoutMs > 180000) {
  throw new Error("GEMINI_TIMEOUT_MS must be a whole number between 1000 and 180000.");
}
// Gemini 4 Hydrogen is served through Gemini Enterprise Agent Platform.
// enterprise:true selects that API surface; the key must be an Agent Platform
// Express Mode key, not a standard Google AI Studio Gemini API key.
const ai = new GoogleGenAI({ enterprise: true, apiKey });
const model = process.env.GEMINI_MODEL?.trim() || "gemini-4-hydrogen";
const systemInstruction =
  process.env.BOT_SYSTEM_PROMPT ||
  "You are Echidna, a helpful and clear Discord community assistant. Be concise, accurate, and respectful.";

export async function generateReply(history, userText) {
  const contents = [
    ...history.map((entry) => ({
      role: entry.role,
      parts: [{ text: entry.text }],
    })),
    { role: "user", parts: [{ text: userText }] },
  ];

  const result = await ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction,
      maxOutputTokens: 1200,
      // MEDIUM keeps general community replies useful while avoiding Hydrogen's
      // higher-latency HIGH reasoning default.
      thinkingConfig: { thinkingLevel: "MEDIUM" },
      // Abort stalled Gemini calls instead of leaving a channel waiting forever.
      abortSignal: AbortSignal.timeout(requestTimeoutMs),
      httpOptions: { timeout: requestTimeoutMs },
    },
  });

  const responseText = result.text?.trim();
  if (!responseText) {
    throw new Error("Gemini returned an empty response.");
  }
  return responseText;
}
