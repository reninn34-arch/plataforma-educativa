import { createOpenAI } from "@ai-sdk/openai";

// Modelos disponibles en OpenCode Go (OpenAI-compatible):
// - deepseek-v4-pro     → 3,450 req/5h (el mas potente)
// - deepseek-v4-flash   → 31,650 req/5h (rapido y economico)
// - qwen3.5-plus        → 10,200 req/5h (balance rendimiento/costo)
// - qwen3.6-plus        → 3,300 req/5h
// - qwen3.7-max         → 950 req/5h
// - glm-5                → 1,150 req/5h
// - glm-5.1              → 880 req/5h
// - kimi-k2.5            → 1,850 req/5h
// - kimi-k2.6            → 1,150 req/5h

// Modelo por defecto para la plataforma (balance costo/rendimiento)
export const DEFAULT_MODEL = "kimi-k2.5";

export const opencodeGo = createOpenAI({
  baseURL: process.env.OPENCODE_GO_BASE_URL || "https://opencode.ai/zen/go/v1",
  apiKey: process.env.OPENCODE_GO_API_KEY,
});

// Usar .chat() para forzar Chat Completions API (OpenCode Go no expone Responses API)
export const opencodeGoModel = opencodeGo.chat(DEFAULT_MODEL);
