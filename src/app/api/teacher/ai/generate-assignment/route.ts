import { NextRequest, NextResponse } from "next/server";
import { getChatModel, getChatModelCandidates, isRetryableModelError, logAiCall, resolveModel, tryParseJson } from "@/lib/ai";
import { generateObject, generateText } from "ai";
import { z } from "zod/v4";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
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

const ASSIGNMENT_KEY_MAP: Record<string, string> = {
  titulo: "title",
  title: "title",
  descripcion: "description",
  description: "description",
  preguntas: "questions",
  questions: "questions",
  tipo: "type",
  type: "type",
  pregunta: "question",
  question: "question",
  opciones: "options",
  options: "options",
  indicecorrecto: "correctIndex",
  correctindex: "correctIndex",
  puntos: "points",
  points: "points",
};

function normalizeAssignmentKeys(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map(normalizeAssignmentKeys);
  }
  const result: any = {};
  for (const key of Object.keys(obj)) {
    const cleanKey = key
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/_/g, "")
      .replace(/\s+/g, "");
    const targetKey = ASSIGNMENT_KEY_MAP[cleanKey] || cleanKey;
    result[targetKey] = normalizeAssignmentKeys(obj[key]);
  }
  return result;
}

const questionItemSchema = z.preprocess((val: any) => {
  if (val && typeof val === "object") {
    let typeVal = String(val.type ?? "").toLowerCase();
    if (typeVal.includes("opcion") || typeVal.includes("multiple") || typeVal.includes("mcq")) {
      val.type = "mcq";
    } else if (typeVal.includes("upload") || typeVal.includes("archivo") || typeVal.includes("subir")) {
      val.type = "file_upload";
    }
    
    // Normalization of common keys
    if (val.pregunta && !val.question) val.question = val.pregunta;
    if (val.opciones && !val.options) val.options = val.opciones;
    if ((val.indicecorrecto || val.correctindex) && val.correctIndex === undefined) {
      val.correctIndex = val.indicecorrecto ?? val.correctindex;
    }
    if ((val.puntos || val.points) && val.points === undefined) {
      val.points = val.puntos ?? val.points;
    }
    if (val.points !== undefined && val.points !== null) {
      val.points = Number(val.points);
    }
    if (val.correctIndex !== undefined && val.correctIndex !== null) {
      val.correctIndex = Number(val.correctIndex);
    }
  }
  return val;
}, z.discriminatedUnion("type", [mcqQuestionSchema, fileUploadQuestionSchema]));

const generateResponseSchema = z.preprocess((val: any) => {
  const normalized = normalizeAssignmentKeys(val);
  if (normalized && typeof normalized === "object") {
    if (normalized.titulo && !normalized.title) normalized.title = normalized.titulo;
    if (normalized.descripcion && !normalized.description) normalized.description = normalized.descripcion;
    if (normalized.preguntas && !normalized.questions) normalized.questions = normalized.preguntas;
  }
  return normalized;
}, z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(10),
  questions: z.array(questionItemSchema).min(1).max(15),
}));

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
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
- Descripcion: 2 parrafos con instrucciones y contexto practico.

Debes responder UNICAMENTE con un objeto JSON valido que coincida exactamente con esta estructura:
{
  "title": "string (max 80 caracteres)",
  "description": "string (min 10 caracteres, 2 parrafos)",
  "questions": [
    {
      "type": "mcq",
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correctIndex": 0,
      "points": 1
    }
  ]
}`;

    const REQUEST_TIMEOUT_MS = 60_000;
    const MAX_CANDIDATES = 3;
    let lastError: unknown;

    for (const candidate of candidates.slice(0, MAX_CANDIDATES)) {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

      try {
        const start = Date.now();
        const isTextOnlyProvider = candidate.provider === "groq" || candidate.provider === "deepseek";

        if (isTextOnlyProvider) {
          const textResponse = await generateText({
            model: getChatModel(candidate),
            prompt: prompt + `\n\nResponde SOLO con un JSON valido. No incluyas texto adicional, solo el JSON.`,
            temperature: 0.6,
            maxOutputTokens: 4000,
            abortSignal: abortController.signal,
          });

          let parsed;
          try {
            parsed = tryParseJson(textResponse.text);
          } catch (parseErr) {
            console.error("[generate-assignment] tryParseJson failed. Raw text was:", textResponse.text);
            throw parseErr;
          }

          let validated;
          try {
            validated = generateResponseSchema.parse(parsed);
          } catch (zodErr) {
            console.error("[generate-assignment] Zod parsing error (isTextOnlyProvider block). Raw text:", textResponse.text);
            console.error("[generate-assignment] parsed JSON:", JSON.stringify(parsed, null, 2));
            throw zodErr;
          }

          clearTimeout(timeoutId);

          logAiCall({
            route: "teacher/ai/generate-assignment-text",
            model: candidate.modelId,
            durationMs: Date.now() - start,
            usage: textResponse.usage ? {
              inputTokens: textResponse.usage.inputTokens,
              outputTokens: textResponse.usage.outputTokens,
              totalTokens: (textResponse.usage.inputTokens ?? 0) + (textResponse.usage.outputTokens ?? 0),
            } : undefined,
          });

          return NextResponse.json({
            success: true,
            data: validated,
            modelUsed: candidate.modelId,
          });
        } else {
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
        }
      } catch (aiError: any) {
        clearTimeout(timeoutId);
        const msg = String(aiError?.message || aiError || "");
        const wasAborted = aiError?.name === "AbortError" || msg.includes("abort");

        if (msg.includes("response_format") || msg.includes("unavailable")) {
          const start = Date.now();
          try {
            const textResponse = await generateText({
              model: getChatModel(candidate),
              prompt: prompt + `\n\nResponde SOLO con un JSON valido. No incluyas texto adicional, solo el JSON.`,
              temperature: 0.6,
              maxOutputTokens: 4000,
              abortSignal: abortController.signal,
            });

            try {
              let parsed;
              try {
                parsed = tryParseJson(textResponse.text);
              } catch (parseErr) {
                console.error("[generate-assignment] tryParseJson failed in catch fallback. Raw text was:", textResponse.text);
                throw parseErr;
              }

              let validated;
              try {
                validated = generateResponseSchema.parse(parsed);
              } catch (zodErr) {
                console.error("[generate-assignment] Zod parsing error (catch fallback block). Raw text:", textResponse.text);
                console.error("[generate-assignment] parsed JSON:", JSON.stringify(parsed, null, 2));
                throw zodErr;
              }

              logAiCall({
                route: "teacher/ai/generate-assignment",
                model: candidate.modelId,
                durationMs: Date.now() - start,
                usage: textResponse.usage ? {
                  inputTokens: textResponse.usage.inputTokens,
                  outputTokens: textResponse.usage.outputTokens,
                  totalTokens: (textResponse.usage.inputTokens ?? 0) + (textResponse.usage.outputTokens ?? 0),
                } : undefined,
              });

              return NextResponse.json({
                success: true,
                data: validated,
                modelUsed: candidate.modelId,
              });
            } catch (parseError: any) {
              lastError = parseError;
              logAiCall({
                route: "teacher/ai/generate-assignment",
                model: candidate.modelId,
                durationMs: Date.now() - start,
                error: `generateText fallback parse error: ${parseError.message || "unknown"}`,
              });
              continue;
            }
          } catch (textModelError: any) {
            lastError = textModelError;
            logAiCall({
              route: "teacher/ai/generate-assignment",
              model: candidate.modelId,
              durationMs: Date.now() - start,
              error: `generateText fallback model error: ${textModelError.message || "unknown"}`,
            });
            if (!isRetryableModelError(textModelError)) {
              return NextResponse.json(
                { error: "Error al generar con IA. Intenta de nuevo." },
                { status: 502 }
              );
            }
            continue;
          }
        }

        lastError = aiError;

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
