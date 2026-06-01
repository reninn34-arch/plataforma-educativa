import { NextRequest } from "next/server";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { embeddingSimilaritySchema } from "@/lib/api-helpers";
import { generateEmbeddings, logAiCall } from "@/lib/ai";
import { rateLimit } from "@/lib/rate-limit";

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const limit = rateLimit({
    key: `ai-embedding-similarity:${user.id}`,
    maxRequests: 20,
    windowMs: 60_000,
  });
  if (limit) return limit;

  try {
    const parsed = embeddingSimilaritySchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "query y candidates son requeridos" }, { status: 400 });
    }

    const { query, candidates, topK, model } = parsed.data;
    const start = Date.now();

    const allTexts = [query, ...candidates];
    const result = await generateEmbeddings(allTexts, model);

    const [queryEmbedding, ...candidateEmbeddings] = result.embeddings;
    const scored = candidates.map((text, index) => {
      const score = cosineSimilarity(queryEmbedding, candidateEmbeddings[index]);
      return {
        index,
        text,
        score,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    const take = Math.min(topK ?? scored.length, scored.length);
    const topMatches = scored.slice(0, take);

    logAiCall({
      route: "ai/embedding/similarity",
      model: result.model.modelId,
      durationMs: Date.now() - start,
    });

    return Response.json({
      model: result.model.modelId,
      totalCandidates: candidates.length,
      topK: take,
      matches: topMatches,
    });
  } catch (error: any) {
    const message = String(error?.message || "Error al calcular similitud");
    if (message.includes("no permitido") || message.includes("formato invalido") || message.includes("debe ser")) {
      return Response.json({ error: message }, { status: 400 });
    }
    if (message.includes("no configurado") || message.includes("no expone")) {
      return Response.json({ error: message }, { status: 422 });
    }
    console.error("Embedding similarity error:", error);
    return Response.json({ error: "Error al calcular similitud" }, { status: 500 });
  }
}
