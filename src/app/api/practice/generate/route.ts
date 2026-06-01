import { NextRequest, NextResponse } from "next/server";
import { getChatModel, getChatModelCandidates, isRetryableModelError, logAiCall, resolveModel, repairJson, tryParseJson } from "@/lib/ai";
import { db } from "@/lib/db";
import { nodes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateText, Output } from "ai";
import { z } from "zod/v4";
import { verifyToken } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { practiceGenerateSchema } from "@/lib/api-helpers";

export const CACHED_EXERCISES_VERSION = 2;

const diagramSchema = z.object({
  mermaid: z.string(),
  caption: z.string(),
});

const lessonSchema = z.object({
  title: z.string(),
  explanation: z.string(),
  example: z.object({
    problem: z.string(),
    steps: z.array(z.string()),
    answer: z.string(),
  }),
  commonMistake: z.object({
    description: z.string(),
    correction: z.string(),
  }),
  diagram: diagramSchema.optional(),
  quickCheck: z.object({
    question: z.string(),
    options: z.array(z.string()).length(4),
    correctIndex: z.number().int().min(0).max(3),
    feedback: z.string(),
  }),
});

const exerciseItemSchema = z.object({
  id: z.number().optional().default(0),
  type: z.enum(["mcq", "fill_blank", "true_false"]),
  question: z.string(),
  options: z.array(z.string()).optional(),
  correctIndex: z.number().optional(),
  acceptedAnswers: z.array(z.string()).optional(),
  correctAnswer: z.boolean().optional(),
  timeLimit: z.number().nullable(),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

const practiceResponseSchema = z.object({
  lesson: lessonSchema,
  exercises: z.array(exerciseItemSchema).length(4),
});

const cachedExercisesSchema = z.object({
  version: z.number(),
  data: practiceResponseSchema,
});

const SUBJECT_CONTEXTS: Record<string, { area: string; topics: string[]; canHaveDiagram: boolean }> = {
  matematicas: {
    area: "Matematicas - Bachillerato Acelerado para Adultos",
    topics: ["Ecuaciones lineales", "Porcentajes", "Geometria basica", "Fracciones", "Regla de tres", "Algebra elemental", "Area y perimetro", "Operaciones basicas"],
    canHaveDiagram: true,
  },
  fisica: {
    area: "Fisica - Bachillerato Acelerado para Adultos",
    topics: ["Leyes de Newton", "Movimiento rectilineo", "Energia cinetica y potencial", "Ondas y sonido", "Electricidad basica", "Magnetismo", "Calor y temperatura", "Optica"],
    canHaveDiagram: true,
  },
  ingles: {
    area: "Ingles - Bachillerato Acelerado para Adultos",
    topics: ["Verbo To Be", "Presente simple", "Pasado simple", "Futuro con Will", "Vocabulario basico", "Preposiciones", "Adjetivos", "Conversacion basica"],
    canHaveDiagram: false,
  },
  quimica: {
    area: "Quimica - Bachillerato Acelerado para Adultos",
    topics: ["Tabla periodica", "Enlaces quimicos", "Reacciones quimicas", "Estados de la materia", "Acidos y bases", "Balanceo de ecuaciones", "Compuestos organicos", "Estequiometria"],
    canHaveDiagram: true,
  },
};

function isResponseFormatError(error: unknown): boolean {
  const msg = String((error as any)?.message ?? "").toLowerCase();
  return msg.includes("response_format") || msg.includes("unavailable");
}

function normalizePracticeOutput(data: any): any {
  if (!data || !Array.isArray(data.exercises)) return data;
  const normalized = data.exercises.map((ex: any) => {
    if (!ex) return ex;
    // Normalize type
    let type = ex.type;
    if (typeof type === "string") {
      const t = type.toLowerCase().trim();
      if (t === "mcq" || t === "multiple_choice" || t === "multiple choice" || t === "opcion multiple") type = "mcq";
      else if (t === "fill_blank" || t === "fill_in_the_blank" || t === "fill in the blank" || t === "completar" || t === "complete") type = "fill_blank";
      else if (t === "true_false" || t === "true or false" || t === "verdadero_falso" || t === "verdadero o falso" || t === "boolean") type = "true_false";
      else type = "mcq";
    }
    // Normalize difficulty
    let difficulty = ex.difficulty;
    if (typeof difficulty === "string") {
      const d = difficulty.toLowerCase().trim();
      if (d.startsWith("eas") || d === "bajo" || d === "baja" || d === "1") difficulty = "easy";
      else if (d.startsWith("med") || d === "intermedio" || d === "intermedia" || d === "2") difficulty = "medium";
      else if (d.startsWith("har") || d === "dificil" || d === "avanzado" || d === "3") difficulty = "hard";
      else difficulty = "medium";
    }
    return { ...ex, type, difficulty };
  });
  return { ...data, exercises: normalized };
}

async function generateStructured<T>(
  model: ReturnType<typeof getChatModel>,
  prompt: string,
  schema: z.ZodType<T>,
  opts: { temperature: number; maxOutputTokens: number; abortSignal: AbortSignal },
): Promise<{ output: T; text: string }> {
  // Tier 1: Output.object({ schema }) passes schema to model → best structure (Kimi, OpenAI, Google, Anthropic)
  try {
    const response = await generateText({
      model,
      output: Output.object({ schema: schema as any }),
      prompt,
      temperature: opts.temperature,
      maxOutputTokens: opts.maxOutputTokens,
      abortSignal: opts.abortSignal,
    });
    return {
      output: response.output as T,
      text: response.text,
    };
  } catch (error) {
    // Tier 2: response_format unsupported → try Output.json() with normalization (DeepSeek)
    if (isResponseFormatError(error)) {
      try {
        const response = await generateText({
          model,
          output: Output.json(),
          prompt,
          temperature: opts.temperature,
          maxOutputTokens: opts.maxOutputTokens,
          abortSignal: opts.abortSignal,
        });
        const normalized = normalizePracticeOutput(response.output);
        return {
          output: schema.parse(normalized),
          text: response.text,
        };
      } catch (jsonError) {
        // Tier 3: plain text + tryParseJson as last resort
        if (isResponseFormatError(jsonError) || jsonError instanceof z.ZodError) {
          const response = await generateText({
            model,
            prompt,
            temperature: opts.temperature,
            maxOutputTokens: opts.maxOutputTokens,
            abortSignal: opts.abortSignal,
          });
          const json = tryParseJson(response.text);
          const normalized = normalizePracticeOutput(json);
          return {
            output: schema.parse(normalized),
            text: response.text,
          };
        }
        throw jsonError;
      }
    }
    throw error;
  }
}

// ── POST handler ──

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user || user.role !== "student") return NextResponse.json({ error: "Solo estudiantes" }, { status: 403 });

  try {
    const inputParsed = practiceGenerateSchema.safeParse(await request.json());
    if (!inputParsed.success) {
      return Response.json({ error: "Materia requerida" }, { status: 400 });
    }
    const { subject, topic, aiPromptContext, nodeId, retry, model } = inputParsed.data;

    const resolved = resolveModel(model);
    if (resolved.error) {
      return Response.json({ error: resolved.error }, { status: 400 });
    }
    const candidates = getChatModelCandidates(model);

    // DB cache check
    if (nodeId && !retry) {
      const nodeRecord = await db
        .select({ cachedExercises: nodes.cachedExercises })
        .from(nodes)
        .where(eq(nodes.id, nodeId))
        .limit(1);

      if (nodeRecord.length > 0 && nodeRecord[0].cachedExercises) {
        const raw = nodeRecord[0].cachedExercises as any;
        const envelope = cachedExercisesSchema.safeParse(raw);
        if (envelope.success && envelope.data.version === CACHED_EXERCISES_VERSION) {
          return Response.json({ ...envelope.data.data, cached: true });
        }
      }
    }

    const rl = rateLimit({ key: `practice-gen:${user.id}`, maxRequests: 10, windowMs: 60_000 });
    if (rl) return rl;

    const ctx = SUBJECT_CONTEXTS[subject] || SUBJECT_CONTEXTS.matematicas;
    const topicContext = aiPromptContext
      ? `${aiPromptContext}`
      : (topic || ctx.topics.slice(0, 1).join(", "));

    const lessonPrompt = `Eres un profesor experto en andragogia para adultos en bachillerato acelerado (PCEI).
Genera una leccion y 4 ejercicios sobre el tema en formato JSON.

AREA: ${ctx.area}
Tema: ${topicContext}

VALORES EXACTOS OBLIGATORIOS PARA EJERCICIOS:
- "type": SOLO "mcq", "fill_blank" o "true_false" (minusculas, sin variantes)
- "difficulty": SOLO "easy", "medium" o "hard" (minusculas, sin variantes)
- "timeLimit": numero (20-40) o null para hard

REGLAS LECCION (SE BREVE):
- "explanation": 3-4 oraciones cortas maximo. Desde cero, con analogia de vida real.
- "example": 2-3 pasos. "answer" en 1 oracion.
- "commonMistake": 1 oracion description, 1 oracion correction.
- "quickCheck": 1 oracion question, feedback en 1 oracion.

REGLAS EJERCICIOS:
- EXACTAMENTE 4 ejercicios.
- Variar tipos: maximo 2 del mismo tipo.
- Dificultad variada: al menos 1 easy, 1 medium, 1 hard.
- MCQ: "options" con 4 strings, "correctIndex" (0-3). NO usar "correctAnswer".
- FILL_BLANK: "acceptedAnswers" OBLIGATORIO (array de strings).
- TRUE_FALSE: "correctAnswer" OBLIGATORIO (true o false).
- Hard: "timeLimit": null. Easy/Medium: "timeLimit" entre 20 y 40.
- Lenguaje claro, ejemplos de la vida real.`;

    const diagramPrompt = ctx.canHaveDiagram
      ? `Genera un diagrama educativo en sintaxis Mermaid.js para el siguiente tema.

AREA: ${ctx.area}
Tema: ${topicContext}

REGLAS:
- Usa graph TD/LR con nodos descriptivos en espanol.
- Tipos de diagrama: Quimica: reacciones/enlaces/estructura atomica. Fisica: fuerzas/flujo de energia. Matematicas: jerarquia de conceptos/pasos de resolucion.
- Usa formas: () rectangulo redondeado, [] rectangulo, {} rombo, (()) circulo.
- Colores sutiles con style: style A fill:#e0f0ff. NO abuses.
- caption: maximo 6 palabras descriptivas.`
      : null;

    const REQUEST_TIMEOUT_MS = 60_000;
    let lessonResult: z.infer<typeof practiceResponseSchema> | null = null;
    let diagram: z.infer<typeof diagramSchema> | null = null;
    let usedModel = resolved;
    let lastError: unknown;

    for (const candidate of candidates) {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

      try {
        const aiModel = getChatModel(candidate);
        const genOpts = { temperature: 0.6, maxOutputTokens: 4000, abortSignal: abortController.signal };

        const lessonPromise = generateStructured(aiModel, lessonPrompt, practiceResponseSchema, genOpts);

        let diagramPromise: Promise<z.infer<typeof diagramSchema> | null> = Promise.resolve(null);
        if (diagramPrompt) {
          const diagramStart = performance.now();
          const diagramGenOpts = { temperature: 0.3, maxOutputTokens: 1500, abortSignal: abortController.signal };
          diagramPromise = generateStructured(aiModel, diagramPrompt, diagramSchema, diagramGenOpts)
            .then((r) => {
              logAiCall({
                route: "practice-diagram",
                model: candidate.modelId,
                durationMs: Math.round(performance.now() - diagramStart),
                usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
              });
              return r.output;
            })
            .catch((err) => {
              console.error("[diagram] failed:", err?.message || err);
              logAiCall({
                route: "practice-diagram",
                model: candidate.modelId,
                durationMs: Math.round(performance.now() - diagramStart),
                error: err?.message || "unknown",
              });
              return null;
            });
        }

        const startTime = performance.now();
        const [lessonAttempt, diagramAttempt] = await Promise.all([lessonPromise, diagramPromise]);
        const durationMs = Math.round(performance.now() - startTime);
        clearTimeout(timeoutId);

        logAiCall({
          route: "practice-generate",
          model: candidate.modelId,
          durationMs,
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        });

        lessonResult = lessonAttempt.output;
        diagram = diagramAttempt;
        usedModel = candidate;
        break;
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error;
        if (!isRetryableModelError(error)) throw error;
      }
    }

    if (!lessonResult) throw (lastError ?? new Error("No se pudo generar practica con los modelos configurados"));

    lessonResult.exercises = lessonResult.exercises.map((ex: z.infer<typeof exerciseItemSchema>, i: number) => ({ ...ex, id: i + 1 }));

    if (diagram) {
      lessonResult.lesson.diagram = diagram;
    }

    // Cache to DB
    if (nodeId) {
      await db
        .update(nodes)
        .set({
          cachedExercises: {
            version: CACHED_EXERCISES_VERSION,
            data: lessonResult,
          } as any,
        })
        .where(eq(nodes.id, nodeId));
    }

    return Response.json({ ...lessonResult, modelUsed: usedModel.modelId });
  } catch (error) {
    console.error("Generate exercises error:", error);
    return Response.json(
      { error: "Error al generar ejercicios. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
