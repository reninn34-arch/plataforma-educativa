import { createOpenAI } from "@ai-sdk/openai";
import { getEnv } from "@/lib/env";

const env = getEnv();

export const DEFAULT_MODEL = "kimi-k2.5";

export const opencodeGo = createOpenAI({
  baseURL: env.OPENCODE_GO_BASE_URL || "https://opencode.ai/zen/go/v1",
  apiKey: env.OPENCODE_GO_API_KEY,
});

export const opencodeGoModel = opencodeGo.chat(DEFAULT_MODEL);

export const diagramModel = opencodeGo.chat("deepseek-v4-pro");

interface AiCallLog {
  route: string;
  model: string;
  durationMs: number;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  cached?: boolean;
  error?: string;
}

export function logAiCall(log: AiCallLog) {
  const parts = [
    `[AI] ${log.route}`,
    `model=${log.model}`,
    `duration=${log.durationMs}ms`,
  ];
  if (log.usage) {
    parts.push(`tokens=${log.usage.totalTokens ?? "?"} (in:${log.usage.inputTokens ?? "?"} out:${log.usage.outputTokens ?? "?"})`);
  }
  if (log.cached) parts.push("cached");
  if (log.error) parts.push(`ERROR=${log.error}`);
  console.log(parts.join(" "));
}
