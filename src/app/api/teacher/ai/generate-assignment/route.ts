import { NextRequest, NextResponse } from "next/server";
import { getChatModel, getChatModelCandidates, isRetryableModelError, logAiCall, resolveModel, type ResolvedModel } from "@/lib/ai";
import { generateText } from "ai";
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

const GENERATE_PROMPT = `Eres un docente experto creando tareas para educacion secundaria acelerada de adultos (PCEI Ecuador). Responde EXCLUSIVAMENTE con JSON valido.

USA SOLO PREGUNTAS MCQ (multiple choice). NO uses file_upload a menos que el tema sea imposible sin ello. Las MCQ deben tener EXACTAMENTE 4 campos obligatorios: type, question, options, correctIndex, points.

FORMATO JSON OBLIGATORIO (copia esta estructura exacta):
{
  "title": "Titulo claro (max 80 chars)",
  "description": "2 parrafos con instrucciones y contexto practico para adultos",
  "questions": [
    {
      "type": "mcq",
      "question": "Enunciado de la pregunta",
      "options": ["Opcion A", "Opcion B", "Opcion C", "Opcion D"],
      "correctIndex": 0,
      "points": 2
    }
  ]
}

REGLAS ESTRICTAS:
1. Solo preguntas MCQ. NUNCA omitas "question", "options", "correctIndex" o "points".
2. "options": EXACTAMENTE 4 strings en array. "correctIndex": 0-3 (A=0, B=1, C=2, D=3).
3. "points": 1-3 para preguntas faciles, 4-5 para dificiles.
4. Lenguaje adulto, practico, laboral. Contexto ecuatoriano.
5. CRITICO: responde SOLO el JSON. Sin markdown, sin triple backtick, sin texto antes/despues.`;

const REPAIR_SYSTEM_PROMPT = `Eres un reparador de JSON. El siguiente texto deberia ser JSON valido pero tiene errores de formato.
Corrige los errores (comas faltantes, llaves desbalanceadas, strings sin cerrar) y devuelve UNICAMENTE el JSON reparado, sin markdown ni explicaciones.`;

function repairJson(text: string): string {
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

function tryParseJson(text: string): any {
  try { return JSON.parse(text); } catch { /* continue */ }
  try { return JSON.parse(repairJson(text)); } catch { /* continue */ }
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try { return JSON.parse(repairJson(text.slice(firstBrace, lastBrace + 1))); } catch { /* continue */ }
  }
  throw new Error("No se pudo extraer JSON valido de la respuesta");
}

async function repairWithAi(malformed: string, resolvedModel: ResolvedModel): Promise<any> {
  const { text } = await generateText({
    model: getChatModel(resolvedModel),
    system: REPAIR_SYSTEM_PROMPT,
    prompt: malformed,
    temperature: 0.1,
    maxOutputTokens: 4000,
  });
  return tryParseJson(text);
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

    const prompt = `${GENERATE_PROMPT}\n\nMateria: ${subject}\nTema: ${topic}\nCantidad de preguntas: ${count}\nTrimestre: ${body.trimester || 1}`;

    const start = Date.now();
    let rawText = "";
    const REQUEST_TIMEOUT_MS = 60_000;
    let lastError: unknown;

    for (const candidate of candidates) {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await generateText({
          model: getChatModel(candidate),
          prompt,
          temperature: 0.6,
          maxOutputTokens: 4000,
          abortSignal: abortController.signal,
        });
        clearTimeout(timeoutId);
        rawText = response.text || "";

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

        let result: any;
        try {
          result = tryParseJson(rawText);
        } catch {
          try {
            result = await repairWithAi(rawText, candidate);
          } catch {
            continue;
          }
        }

        const parsed = generateResponseSchema.safeParse(result);
        if (parsed.success) {
          return NextResponse.json({
            success: true,
            data: parsed.data,
            modelUsed: candidate.modelId,
          });
        }

        console.error(
          `[AI Assignment] Schema validation failed with ${candidate.modelId}:`,
          parsed.error.issues.map((i: any) => i.path?.join(".") || i.message).slice(0, 5),
        );
      } catch (aiError: any) {
        clearTimeout(timeoutId);
        lastError = aiError;

        const wasAborted = aiError?.name === "AbortError" || String(aiError?.message || "").includes("abort");
        logAiCall({
          route: "teacher/ai/generate-assignment",
          model: candidate.modelId,
          durationMs: Date.now() - start,
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
      { error: "Ningun modelo pudo generar datos completos. Intenta con otro tema." },
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
