import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("Missing GEMINI_API_KEY environment variable.");
}

const requestTimeoutMs = Number(process.env.GEMINI_TIMEOUT_MS || 60000);
const ai = new GoogleGenAI({ apiKey });
const model = process.env.GEMINI_MODEL || "gemini-4-hydrogen";
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
