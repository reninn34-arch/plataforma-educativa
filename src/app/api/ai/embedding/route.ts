/**
 * @swagger
 * /api/ai/embedding:
 *   post:
 *     summary: Generar embedding de texto
 *     description: Genera un vector de embedding para un texto utilizando el modelo de IA configurado.
 *     tags: [Práctica e IA]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text:
 *                 type: string
 *                 description: Texto a convertir en embedding
 *               model:
 *                 type: string
 *                 description: Modelo de embedding
 *     responses:
 *       200:
 *         description: Embedding generado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 model:
 *                   type: string
 *                 dimensions:
 *                   type: integer
 *                 embedding:
 *                   type: array
 *                   items:
 *                     type: number
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       422:
 *         description: Modelo no configurado
 *       500:
 *         description: Error interno
 */
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al generar embedding";
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
