import { NextRequest, NextResponse } from "next/server";
import { getChatModel, getChatModelCandidates, isRetryableModelError, logAiCall, resolveModel, repairJson, tryParseJson } from "@/lib/ai";
import { generateText, Output } from "ai";
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

function isResponseFormatError(error: unknown): boolean {
  const msg = String((error as any)?.message ?? "").toLowerCase();
  return msg.includes("response_format") || msg.includes("unavailable");
}

function normalizeQuestions(data: any): any {
  if (!data || !Array.isArray(data.questions)) return data;
  const normalized = data.questions.map((q: any) => {
    if (!q || typeof q.type !== "string") return q;
    const t = q.type.toLowerCase().trim();
    if (t === "mcq" || t === "multiple_choice" || t === "multiple choice" || t === "opcion multiple" || t === "opcion_multiple") {
      return { ...q, type: "mcq" };
    }
    if (t === "file_upload" || t === "file" || t === "upload" || t === "archivo" || t === "subir_archivo") {
      return { ...q, type: "file_upload" };
    }
    return { ...q, type: "mcq" };
  });
  return { ...data, questions: normalized };
}

async function generateWithFallback(
  candidate: ReturnType<typeof getChatModelCandidates>[number],
  prompt: string,
  abortSignal: AbortSignal,
) {
  // Tier 1: Output.object({ schema }) (Kimi, OpenAI, Google, Anthropic)
  try {
    const response = await generateText({
      model: getChatModel(candidate),
      output: Output.object({ schema: generateResponseSchema as any }),
      prompt,
      temperature: 0.6,
      maxOutputTokens: 4000,
      abortSignal,
    });
    return {
      output: response.output,
      parsed: response.output as z.infer<typeof generateResponseSchema>,
      usage: response.usage,
    };
  } catch (error) {
    // Tier 2: response_format unsupported → Output.json() with normalization (DeepSeek)
    if (isResponseFormatError(error)) {
      try {
        const response = await generateText({
          model: getChatModel(candidate),
          output: Output.json(),
          prompt,
          temperature: 0.6,
          maxOutputTokens: 4000,
          abortSignal,
        });
        const normalized = normalizeQuestions(response.output);
        return {
          output: normalized,
          parsed: generateResponseSchema.parse(normalized),
          usage: response.usage,
        };
      } catch (jsonError) {
        // Tier 3: plain text + tryParseJson as last resort
        if (isResponseFormatError(jsonError) || jsonError instanceof z.ZodError) {
          const textResponse = await generateText({
            model: getChatModel(candidate),
            prompt,
            temperature: 0.6,
            maxOutputTokens: 4000,
            abortSignal,
          });
          const json = tryParseJson(textResponse.text);
          const normalized = normalizeQuestions(json);
          return {
            output: normalized,
            parsed: generateResponseSchema.parse(normalized),
            usage: textResponse.usage,
          };
        }
        throw jsonError;
      }
    }
    throw error;
  }
}

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
Genera una tarea en formato JSON con esta estructura exacta:
{
  "title": "Titulo claro (max 80 caracteres)",
  "description": "2 parrafos con instrucciones y contexto practico",
  "questions": [
    { "type": "mcq", "question": "...", "options": ["A","B","C","D"], "correctIndex": 0, "points": 2 }
  ]
}

VALORES OBLIGATORIOS:
- questions[].type: SOLO "mcq" o "file_upload" (en minusculas, sin variantes)
- questions[].options: array de exactamente 4 strings
- questions[].correctIndex: numero 0-3 (0=A, 1=B, 2=C, 3=D)
- questions[].points: 1-3 facil, 4-5 dificil

Materia: ${subject}
Tema: ${topic}
Cantidad de preguntas: ${count}
Trimestre: ${body.trimester || 1}

Usa lenguaje adulto, practico, laboral con contexto ecuatoriano. Prefiere preguntas tipo "mcq".`;

    const REQUEST_TIMEOUT_MS = 30_000;
    let lastError: unknown;

    for (const candidate of candidates) {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

      try {
        const start = Date.now();
        const result = await generateWithFallback(candidate, prompt, abortController.signal);
        clearTimeout(timeoutId);

        logAiCall({
          route: "teacher/ai/generate-assignment",
          model: candidate.modelId,
          durationMs: Date.now() - start,
          usage: result.usage ? {
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
            totalTokens: (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
          } : undefined,
        });

        return NextResponse.json({
          success: true,
          data: result.parsed,
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
