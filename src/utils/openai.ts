import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error("Missing OPENAI_API_KEY in .env");
  process.exit(1);
}

const openai = new OpenAI({ apiKey });

export async function analyzeSentiment(texts: string[]): Promise<{
  summary: string;
  sentiment: string;
  vibeScore: number;
}> {
  const combined = texts.join("\n---\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You analyze crypto social media posts. Return JSON only with this format:
{
  "summary": "2-3 sentence summary of what people are saying",
  "sentiment": "bullish" | "bearish" | "neutral",
  "vibeScore": 0-100 (0 = extreme fear/bearish, 100 = extreme greed/bullish)
}`
      },
      {
        role: "user",
        content: `Analyze these posts about a token:\n\n${combined}`
      }
    ],
    response_format: { type: "json_object" }
  });

  const content = response.choices[0].message.content || "{}";
  return JSON.parse(content);
}

export async function analyzeRisk(tokenData: any): Promise<{
  summary: string;
  riskScore: number;
  flags: string[];
}> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You analyze Solana token data for risks. Return JSON only with this format:
{
  "summary": "2-3 sentence risk assessment",
  "riskScore": 0-100 (0 = safe, 100 = extreme risk),
  "flags": ["array", "of", "risk", "flags"]
}

Common flags: "dev_holds_large_percent", "mint_authority_enabled", "freeze_authority_enabled", "lp_not_locked", "honeypot_risk", "deployer_rug_history"`
      },
      {
        role: "user",
        content: `Analyze this token:\n\n${JSON.stringify(tokenData, null, 2)}`
      }
    ],
    response_format: { type: "json_object" }
  });

  const content = response.choices[0].message.content || "{}";
  return JSON.parse(content);
}