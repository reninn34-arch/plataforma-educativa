import { NextRequest } from "next/server";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { embeddingSchema } from "@/lib/api-helpers";
import { generateEmbedding, logAiCall } from "@/lib/ai";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const limit = rateLimit({
    key: `ai-embedding:${user.id}`,
    maxRequests: 30,
    windowMs: 60_000,
  });
  if (limit) return limit;

  try {
    const parsed = embeddingSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "text es requerido" }, { status: 400 });
    }

    const { text, model } = parsed.data;
    const start = Date.now();

    const result = await generateEmbedding(text, model);

    logAiCall({
      route: "ai/embedding",
      model: result.model.modelId,
      durationMs: Date.now() - start,
    });

    return Response.json({
      model: result.model.modelId,
      dimensions: result.embedding.length,
      embedding: result.embedding,
    });
  } catch (error: any) {
    const message = String(error?.message || "Error al generar embedding");
    if (message.includes("no permitido") || message.includes("formato invalido") || message.includes("debe ser")) {
      return Response.json({ error: message }, { status: 400 });
    }
    if (message.includes("no configurado") || message.includes("no expone")) {
      return Response.json({ error: message }, { status: 422 });
    }
    console.error("Embedding error:", error);
    return Response.json({ error: "Error al generar embedding" }, { status: 500 });
  }
}
