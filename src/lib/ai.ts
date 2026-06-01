import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embed, embedMany } from "ai";
import { getEnv } from "@/lib/env";

const env = getEnv();

export type AiProvider = "opencode" | "openai" | "anthropic" | "google";

const SUPPORTED_PROVIDERS: AiProvider[] = ["opencode", "openai", "anthropic", "google"];

export const DEFAULT_PROVIDER = env.AI_DEFAULT_PROVIDER;
export const DEFAULT_MODEL = env.AI_DEFAULT_MODEL;
export const DEFAULT_MODEL_ID = `${DEFAULT_PROVIDER}:${DEFAULT_MODEL}`;
export const ENFORCE_ALLOWLIST = env.AI_ENFORCE_ALLOWLIST;
export const DEFAULT_EMBEDDING_PROVIDER = env.AI_DEFAULT_EMBEDDING_PROVIDER;
export const DEFAULT_EMBEDDING_MODEL = env.AI_DEFAULT_EMBEDDING_MODEL;
export const DEFAULT_EMBEDDING_MODEL_ID = `${DEFAULT_EMBEDDING_PROVIDER}:${DEFAULT_EMBEDDING_MODEL}`;
export const ENFORCE_EMBEDDING_ALLOWLIST = env.AI_ENFORCE_EMBEDDING_ALLOWLIST;

export interface ResolvedModel {
  provider: AiProvider;
  model: string;
  modelId: string;
}

function isAiProvider(value: string): value is AiProvider {
  return SUPPORTED_PROVIDERS.includes(value as AiProvider);
}

function parseModelToken(token: string, fallbackProvider: AiProvider): ResolvedModel | null {
  const normalized = token.trim();
  if (!normalized) return null;

  const parts = normalized.split(":");
  if (parts.length === 1) {
    return {
      provider: fallbackProvider,
      model: parts[0].trim(),
      modelId: `${fallbackProvider}:${parts[0].trim()}`,
    };
  }

  const provider = parts[0].trim();
  const model = parts.slice(1).join(":").trim();
  if (!isAiProvider(provider) || !model) return null;

  return { provider, model, modelId: `${provider}:${model}` };
}

function parseModelList(csv: string, fallbackProvider: AiProvider): ResolvedModel[] {
  return csv
    .split(",")
    .map((m) => parseModelToken(m, fallbackProvider))
    .filter((m): m is ResolvedModel => Boolean(m))
    .filter((m) => Boolean(m.model));
}

function toModelIdList(models: ResolvedModel[]): string[] {
  return [...new Set(models.map((m) => m.modelId))];
}

function parseAllowedModels(csv: string, defaultProvider: AiProvider, defaultModel: string): string[] {
  const models = toModelIdList(parseModelList(csv, defaultProvider));

  const defaultModelId = `${defaultProvider}:${defaultModel}`;
  if (!models.includes(defaultModelId)) {
    models.unshift(defaultModelId);
  }

  return [...new Set(models)];
}

export const ALLOWED_MODELS = parseAllowedModels(env.AI_ALLOWED_MODELS, DEFAULT_PROVIDER, DEFAULT_MODEL);
export const ALLOWED_EMBEDDING_MODELS = parseAllowedModels(
  env.AI_ALLOWED_EMBEDDING_MODELS,
  DEFAULT_EMBEDDING_PROVIDER,
  DEFAULT_EMBEDDING_MODEL,
);
export const FALLBACK_MODELS = toModelIdList(parseModelList(env.AI_FALLBACK_MODELS, DEFAULT_PROVIDER));
export const FALLBACK_EMBEDDING_MODELS = toModelIdList(
  parseModelList(env.AI_FALLBACK_EMBEDDING_MODELS, DEFAULT_EMBEDDING_PROVIDER),
);

function toResolved(modelId: string): ResolvedModel | null {
  const parsed = parseModelToken(modelId, DEFAULT_PROVIDER);
  if (!parsed) return null;
  return parsed;
}

function uniqueResolved(models: Array<ResolvedModel | null>): ResolvedModel[] {
  const out: ResolvedModel[] = [];
  const seen = new Set<string>();
  for (const model of models) {
    if (!model || seen.has(model.modelId)) continue;
    seen.add(model.modelId);
    out.push(model);
  }
  return out;
}

export const opencodeGo = env.OPENCODE_GO_API_KEY
  ? createOpenAI({
      baseURL: env.OPENCODE_GO_BASE_URL || "https://opencode.ai/zen/go/v1",
      apiKey: env.OPENCODE_GO_API_KEY,
    })
  : null;

export const openai = env.OPENAI_API_KEY
  ? createOpenAI({
      apiKey: env.OPENAI_API_KEY,
    })
  : null;

export const anthropic = env.ANTHROPIC_API_KEY
  ? createAnthropic({
      apiKey: env.ANTHROPIC_API_KEY,
    })
  : null;

export const google = env.GOOGLE_GENERATIVE_AI_API_KEY
  ? createGoogleGenerativeAI({
      apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
    })
  : null;

function getProviderClient(provider: AiProvider) {
  switch (provider) {
    case "opencode":
      if (!opencodeGo) {
        throw new Error("Proveedor opencode no configurado. Falta OPENCODE_GO_API_KEY");
      }
      return opencodeGo;
    case "openai":
      if (!openai) {
        throw new Error("Proveedor openai no configurado. Falta OPENAI_API_KEY");
      }
      return openai;
    case "anthropic":
      if (!anthropic) {
        throw new Error("Proveedor anthropic no configurado. Falta ANTHROPIC_API_KEY");
      }
      return anthropic;
    case "google":
      if (!google) {
        throw new Error("Proveedor google no configurado. Falta GOOGLE_GENERATIVE_AI_API_KEY");
      }
      return google;
    default:
      throw new Error(`Proveedor no soportado: ${provider as string}`);
  }
}

export function getChatModel(target: ResolvedModel | string) {
  const model = typeof target === "string" ? target : target.model;
  const provider = typeof target === "string" ? DEFAULT_PROVIDER : target.provider;
  const client = getProviderClient(provider) as any;

  // Prefer .chat() method — calling the provider as a function creates a
  // "responses" model (hits /responses) which OpenCode and most gateways
  // don't support.  .chat() hits /chat/completions which is the standard.
  if (typeof client.chat === "function") {
    return client.chat(model);
  }

  if (typeof client === "function") {
    return client(model);
  }

  throw new Error(`Proveedor ${provider} no expone un modelo de chat compatible`);

}

export function getEmbeddingModel(target: ResolvedModel | string) {
  const model = typeof target === "string" ? target : target.model;
  const provider = typeof target === "string" ? DEFAULT_EMBEDDING_PROVIDER : target.provider;
  const client = getProviderClient(provider) as any;

  if (typeof client.textEmbeddingModel === "function") {
    return client.textEmbeddingModel(model);
  }

  if (typeof client.embeddingModel === "function") {
    return client.embeddingModel(model);
  }

  if (typeof client.embedding === "function") {
    return client.embedding(model);
  }

  // Never call the provider as a function for embeddings — it would create
  // a chat/responses model, not an embedding model.
  throw new Error(`Proveedor ${provider} no expone un modelo de embedding compatible`);
}

export function resolveModel(requestedModel: unknown): (ResolvedModel & { error?: string }) {
  const fallback = {
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
    modelId: DEFAULT_MODEL_ID,
  };

  if (requestedModel === undefined || requestedModel === null) {
    return fallback;
  }

  if (typeof requestedModel !== "string") {
    return { ...fallback, error: "El modelo debe ser un texto" };
  }

  const parsed = parseModelToken(requestedModel, DEFAULT_PROVIDER);
  if (!parsed || !parsed.model) {
    return { ...fallback, error: "El modelo no puede estar vacio o tiene formato invalido" };
  }

  if (ENFORCE_ALLOWLIST && !ALLOWED_MODELS.includes(parsed.modelId)) {
    return {
      ...fallback,
      error: `Modelo no permitido. Modelos habilitados: ${ALLOWED_MODELS.join(", ")}`,
    };
  }

  return parsed;
}

export function resolveEmbeddingModel(requestedModel: unknown): (ResolvedModel & { error?: string }) {
  const fallback = {
    provider: DEFAULT_EMBEDDING_PROVIDER,
    model: DEFAULT_EMBEDDING_MODEL,
    modelId: DEFAULT_EMBEDDING_MODEL_ID,
  };

  if (requestedModel === undefined || requestedModel === null) {
    return fallback;
  }

  if (typeof requestedModel !== "string") {
    return { ...fallback, error: "El modelo de embedding debe ser un texto" };
  }

  const parsed = parseModelToken(requestedModel, DEFAULT_EMBEDDING_PROVIDER);
  if (!parsed || !parsed.model) {
    return { ...fallback, error: "El modelo de embedding no puede estar vacio o tiene formato invalido" };
  }

  if (ENFORCE_EMBEDDING_ALLOWLIST && !ALLOWED_EMBEDDING_MODELS.includes(parsed.modelId)) {
    return {
      ...fallback,
      error: `Modelo de embedding no permitido. Modelos habilitados: ${ALLOWED_EMBEDDING_MODELS.join(", ")}`,
    };
  }

  return parsed;
}

function maybeFilterAllowed(models: ResolvedModel[]): ResolvedModel[] {
  if (!ENFORCE_ALLOWLIST) return models;
  return models.filter((model) => ALLOWED_MODELS.includes(model.modelId));
}

function maybeFilterAllowedEmbeddings(models: ResolvedModel[]): ResolvedModel[] {
  if (!ENFORCE_EMBEDDING_ALLOWLIST) return models;
  return models.filter((model) => ALLOWED_EMBEDDING_MODELS.includes(model.modelId));
}

export function getChatModelCandidates(requestedModel: unknown): ResolvedModel[] {
  const primary = resolveModel(requestedModel);
  if (primary.error) {
    throw new Error(primary.error);
  }

  const defaultModel = toResolved(DEFAULT_MODEL_ID);
  const fallbackModels = FALLBACK_MODELS.map((id) => toResolved(id));
  return maybeFilterAllowed(uniqueResolved([primary, ...fallbackModels, defaultModel]));
}

export function getEmbeddingModelCandidates(requestedModel: unknown): ResolvedModel[] {
  const primary = resolveEmbeddingModel(requestedModel);
  if (primary.error) {
    throw new Error(primary.error);
  }

  const defaultModel = parseModelToken(DEFAULT_EMBEDDING_MODEL_ID, DEFAULT_EMBEDDING_PROVIDER);
  const fallbackModels = FALLBACK_EMBEDDING_MODELS
    .map((id) => parseModelToken(id, DEFAULT_EMBEDDING_PROVIDER));
  return maybeFilterAllowedEmbeddings(uniqueResolved([primary, ...fallbackModels, defaultModel]));
}

export function isRetryableModelError(error: unknown): boolean {
  const message = String((error as any)?.message ?? error ?? "").toLowerCase();
  return (
    message.includes("not found")
    || message.includes("404")
    || message.includes("model")
    || message.includes("unsupported")
    || message.includes("no configurado")
    || message.includes("response_format")
    || message.includes("unavailable")
  );
}

export function repairJson(text: string): string {
  text = text.trim();
  text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let prevChar = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\" && prevChar !== "\\") { prevChar = c; continue; }
      if (c === '"' && prevChar !== "\\") { inString = false; prevChar = c; continue; }
      prevChar = c;
      continue;
    }
    if (c === '"') { inString = true; prevChar = c; continue; }
    if (c === "{") openBraces++;
    if (c === "}") openBraces--;
    if (c === "[") openBrackets++;
    if (c === "]") openBrackets--;
    prevChar = c;
  }
  if (inString) text += '"';
  text += "]".repeat(Math.max(0, openBrackets));
  text += "}".repeat(Math.max(0, openBraces));
  return text;
}

export function tryParseJson(text: string): any {
  try { return JSON.parse(text); } catch { /* fallback */ }
  try { return JSON.parse(repairJson(text)); } catch { /* fallback */ }
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try { return JSON.parse(repairJson(text.slice(firstBrace, lastBrace + 1))); } catch { /* fallback */ }
  }
  throw new Error("No se pudo extraer JSON valido de la respuesta");
}

export async function generateEmbedding(value: string, requestedModel?: unknown) {
  const candidates = getEmbeddingModelCandidates(requestedModel);
  if (!candidates.length) {
    throw new Error("No hay modelos de embedding candidatos configurados");
  }

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const result = await embed({
        model: getEmbeddingModel(candidate),
        value,
      });

      return {
        model: candidate,
        embedding: result.embedding,
      };
    } catch (error) {
      lastError = error;
      if (!isRetryableModelError(error)) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error("No se pudo generar embedding con los modelos configurados");
}

export async function generateEmbeddings(values: string[], requestedModel?: unknown) {
  const candidates = getEmbeddingModelCandidates(requestedModel);
  if (!candidates.length) {
    throw new Error("No hay modelos de embedding candidatos configurados");
  }

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const result = await embedMany({
        model: getEmbeddingModel(candidate),
        values,
      });

      return {
        model: candidate,
        embeddings: result.embeddings,
      };
    } catch (error) {
      lastError = error;
      if (!isRetryableModelError(error)) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error("No se pudo generar embeddings con los modelos configurados");
}

export function getDefaultChatModel() {
  return getChatModel({
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
    modelId: DEFAULT_MODEL_ID,
  });
}

export const opencodeGoModel = getDefaultChatModel();

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
