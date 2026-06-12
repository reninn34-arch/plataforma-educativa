import { z } from "zod/v4";

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return value;
}, z.boolean());

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL es requerida"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET debe tener al menos 16 caracteres"),
  OPENCODE_GO_API_KEY: z.string().min(1).optional(),
  OPENCODE_GO_BASE_URL: z.string().default("https://opencode.ai/zen/go/v1"),
  OPENAI_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),
  AI_API_KEY: z.string().optional(),
  AI_BASE_URL: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_BASE_URL: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  GROQ_BASE_URL: z.string().optional(),
  AI_DEFAULT_PROVIDER: z.preprocess(
    (val) => val ?? process.env.AI_PROVIDER,
    z.enum(["opencode", "openai", "anthropic", "google", "deepseek", "groq"]).default("opencode")
  ),
  AI_DEFAULT_MODEL: z.preprocess(
    (val) => val ?? process.env.AI_MODEL,
    z.string().min(1).default("kimi-k2.5")
  ),
  AI_ALLOWED_MODELS: z.string().default("opencode:kimi-k2.5"),
  AI_ENFORCE_ALLOWLIST: booleanFromEnv.default(false),
  AI_FALLBACK_MODELS: z.string().default(""),
  AI_GROQ_FALLBACK_MODELS: z.string().default(""),
  AI_DEFAULT_EMBEDDING_PROVIDER: z.enum(["opencode", "openai", "anthropic", "google"]).default("opencode"),
  AI_DEFAULT_EMBEDDING_MODEL: z.string().min(1).default("text-embedding-3-small"),
  AI_ALLOWED_EMBEDDING_MODELS: z.string().default("opencode:text-embedding-3-small"),
  AI_ENFORCE_EMBEDDING_ALLOWLIST: booleanFromEnv.default(false),
  AI_FALLBACK_EMBEDDING_MODELS: z.string().default(""),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

let cached: z.infer<typeof envSchema>;

export function getEnv() {
  if (!cached) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      throw new Error("Configuracion de entorno invalida. Revisa .env.local");
    }
    cached = result.data;
  }
  return cached;
}
