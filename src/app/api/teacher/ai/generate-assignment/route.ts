import { NextRequest, NextResponse } from "next/server";
import { getChatModel, getChatModelCandidates, isRetryableModelError, logAiCall, resolveModel } from "@/lib/ai";
import { generateObject } from "ai";
import { z } from "zod/v4";
import { verifyToken } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

const mcqQuestionSchema = z.object({
  type: z.literal("mcq"),
  question: z.string().min(1),
  options: z.array(z.string()).min(2).max(6),
  correctIndex: z.number().int().min(0).max(3),
  points: z.number().int().min(1).max(10).default(1),
});

const fileUploadQuestionSchema = z.object({
  type: z.literal("file_upload"),
  question: z.string().min(1),
  points: z.number().int().min(1).max(10).default(1),
});

const generateResponseSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(10),
  questions: z.array(z.discriminatedUnion("type", [mcqQuestionSchema, fileUploadQuestionSchema]))
    .min(1)
    .max(15),
});

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "Solo docentes y administradores" }, { status: 403 });
  }

  const limit = rateLimit({
    key: `ai-assignment-gen:${user.id}`,
    maxRequests: 15,
    windowMs: 60_000,
  });
  if (limit) return limit;

  try {
    const body = await request.json();
    const { subject, topic, questionCount = 5, model } = body;

    const resolved = resolveModel(model);
    if (resolved.error) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }
    const candidates = getChatModelCandidates(model);

    if (!subject || !topic) {
      return NextResponse.json(
        { error: "Materia y tema son requeridos" },
        { status: 400 }
      );
    }

    const count = Math.min(Math.max(1, questionCount), 15);

    const prompt = `Eres un docente experto en educacion secundaria acelerada para adultos (PCEI Ecuador).
Genera una tarea sobre el siguiente tema.

Materia: ${subject}
Tema: ${topic}
Cantidad de preguntas: ${count}
Trimestre: ${body.trimester || 1}

REGLAS:
- Solo preguntas MCQ (multiple choice). Usa file_upload solo si el tema es imposible sin ello.
- Cada MCQ: 4 opciones (options), correctIndex 0-3, points 1-3 facil / 4-5 dificil.
- Lenguaje adulto, practico, laboral. Contexto ecuatoriano.
- Titulo claro (max 80 caracteres).
- Descripcion: 2 parrafos con instrucciones y contexto practico.`;

    const REQUEST_TIMEOUT_MS = 30_000;
    let lastError: unknown;

    for (const candidate of candidates) {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

      try {
        const start = Date.now();
        const response = await generateObject({
          model: getChatModel(candidate),
          schema: generateResponseSchema,
          prompt,
          temperature: 0.6,
          maxOutputTokens: 4000,
          abortSignal: abortController.signal,
        });
        clearTimeout(timeoutId);

        logAiCall({
          route: "teacher/ai/generate-assignment",
          model: candidate.modelId,
          durationMs: Date.now() - start,
          usage: response.usage ? {
            inputTokens: response.usage.inputTokens,
            outputTokens: response.usage.outputTokens,
            totalTokens: (response.usage.inputTokens ?? 0) + (response.usage.outputTokens ?? 0),
          } : undefined,
        });

        return NextResponse.json({
          success: true,
          data: response.object,
          modelUsed: candidate.modelId,
        });
      } catch (aiError: any) {
        clearTimeout(timeoutId);
        lastError = aiError;

        const wasAborted = aiError?.name === "AbortError" || String(aiError?.message || "").includes("abort");
        logAiCall({
          route: "teacher/ai/generate-assignment",
          model: candidate.modelId,
          durationMs: 0,
          error: wasAborted ? `Timeout (${REQUEST_TIMEOUT_MS / 1000}s)` : (aiError.message || "AI error"),
        });

        if (!isRetryableModelError(aiError) && !wasAborted) {
          return NextResponse.json(
            { error: "Error al generar con IA. Intenta de nuevo." },
            { status: 502 }
          );
        }
      }
    }

    if (lastError) {
      const msg = String((lastError as any)?.message || "");
      if (msg.includes("abort") || msg.includes("Timeout")) {
        return NextResponse.json(
          { error: "La generacion excedio el tiempo limite con todos los modelos. Intenta con menos preguntas." },
          { status: 504 }
        );
      }
      return NextResponse.json(
        { error: "No se pudo generar con los modelos configurados. Ajusta AI_FALLBACK_MODELS o envia un model valido." },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: "Ningun modelo pudo generar datos validos. Intenta con otro tema." },
      { status: 422 }
    );
  } catch (error) {
    console.error("Generate assignment error:", error);
    return NextResponse.json(
      { error: "Error al generar la tarea" },
      { status: 500 }
    );
  }
}
