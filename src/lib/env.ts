import { z } from "zod/v4";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL es requerida"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET debe tener al menos 16 caracteres"),
  OPENCODE_GO_API_KEY: z.string().min(1, "OPENCODE_GO_API_KEY es requerida"),
  OPENCODE_GO_BASE_URL: z.string().default("https://opencode.ai/zen/go/v1"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

let cached: z.infer<typeof envSchema>;

export function getEnv() {
  if (!cached) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      console.error("⚠ Variables de entorno faltantes o invalidas:");
      for (const issue of result.error.issues) {
        console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
      }
      throw new Error("Configuracion de entorno invalida. Revisa .env.local");
    }
    cached = result.data;
  }
  return cached;
}
