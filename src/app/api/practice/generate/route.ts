import { NextRequest, NextResponse } from "next/server";
import { getChatModel, getChatModelCandidates, isRetryableModelError, logAiCall, resolveModel } from "@/lib/ai";
import { db } from "@/lib/db";
import { nodes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateObject } from "ai";
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
Genera una leccion y 4 ejercicios sobre el tema.

AREA: ${ctx.area}
Tema: ${topicContext}

REGLAS LECCION (SE BREVE):
- "explanation": 3-4 oraciones cortas maximo. Desde cero, con analogia de vida real.
- "example": 2-3 pasos. "answer" en 1 oracion.
- "commonMistake": 1 oracion description, 1 oracion correction.
- "quickCheck": 1 oracion question, feedback en 1 oracion.

REGLAS EJERCICIOS:
- EXACTAMENTE 4 ejercicios.
- Variar tipos: maximo 2 del mismo tipo (mcq, fill_blank, true_false).
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

        const lessonPromise = generateObject({
          model: aiModel,
          schema: practiceResponseSchema,
          prompt: lessonPrompt,
          temperature: 0.6,
          maxOutputTokens: 4000,
          abortSignal: abortController.signal,
        });

        let diagramPromise: Promise<z.infer<typeof diagramSchema> | null> = Promise.resolve(null);
        if (diagramPrompt) {
          const diagramStart = performance.now();
          diagramPromise = generateObject({
            model: aiModel,
            schema: diagramSchema,
            prompt: diagramPrompt,
            temperature: 0.3,
            maxOutputTokens: 1500,
            abortSignal: abortController.signal,
          }).then((r) => {
            logAiCall({
              route: "practice-diagram",
              model: candidate.modelId,
              durationMs: Math.round(performance.now() - diagramStart),
              usage: r.usage ? {
                inputTokens: r.usage.inputTokens,
                outputTokens: r.usage.outputTokens,
                totalTokens: (r.usage.inputTokens ?? 0) + (r.usage.outputTokens ?? 0),
              } : undefined,
            });
            return r.object;
          }).catch((err) => {
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
          usage: lessonAttempt.usage ? {
            inputTokens: lessonAttempt.usage.inputTokens,
            outputTokens: lessonAttempt.usage.outputTokens,
            totalTokens: (lessonAttempt.usage.inputTokens ?? 0) + (lessonAttempt.usage.outputTokens ?? 0),
          } : undefined,
        });

        lessonResult = lessonAttempt.object;
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

    lessonResult.exercises = lessonResult.exercises.map((ex, i) => ({ ...ex, id: i + 1 }));

    if (diagram) {
      lessonResult.lesson.diagram = diagram;
    }

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
