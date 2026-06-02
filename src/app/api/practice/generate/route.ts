import { NextRequest, NextResponse } from "next/server";
import { getChatModel, getChatModelCandidates, isRetryableModelError, logAiCall, resolveModel, tryParseJson } from "@/lib/ai";
import { isValidMermaid } from "@/lib/mermaid-validate";
import { db } from "@/lib/db";
import { studentExercises } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { generateObject, generateText } from "ai";
import { z } from "zod/v4";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { practiceGenerateSchema } from "@/lib/api-helpers";
import { searchYouTubeVideos, buildSearchUrl } from "@/lib/youtube";
import { getStudyMaterialForStudent } from "@/lib/study-material";

export const CACHED_EXERCISES_VERSION = 6;

const diagramSchema = z.object({
  mermaid: z.string(),
  caption: z.string(),
});

const exampleStepSchema = z.object({
  text: z.string(),
  svg: z.string().optional(),
});

const lessonSchema = z.object({
  title: z.string(),
  explanation: z.string(),
  example: z.object({
    problem: z.string(),
    steps: z.array(exampleStepSchema),
    answer: z.string(),
  }),
  commonMistake: z.object({
    description: z.string(),
    correction: z.string(),
  }),
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

const videoSchema = z.object({
  id: z.string(),
  title: z.string(),
  channelName: z.string(),
  thumbnailUrl: z.string(),
  duration: z.string(),
});

const practiceResponseSchema = z.object({
  lesson: lessonSchema,
  exercises: z.array(exerciseItemSchema).length(4),
  videos: z.array(videoSchema).default([]),
});

const cachedLessonSchema = lessonSchema.extend({
  diagram: diagramSchema.optional(),
});

const cachedPracticeResponseSchema = z.object({
  lesson: cachedLessonSchema,
  exercises: z.array(exerciseItemSchema).length(4),
  videos: z.array(videoSchema).default([]),
});

const cachedExercisesSchema = z.object({
  version: z.number(),
  data: cachedPracticeResponseSchema,
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
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
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
      const studentRecord = await db
        .select({ data: studentExercises.data })
        .from(studentExercises)
        .where(and(eq(studentExercises.studentId, user.id), eq(studentExercises.nodeId, nodeId)))
        .limit(1);

      if (studentRecord.length > 0) {
        const envelope = cachedExercisesSchema.safeParse(studentRecord[0].data);
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

    const studyMaterial = await getStudyMaterialForStudent(user.id, subject);
    const materialBlock = studyMaterial
      ? `\n\nMATERIAL DE ESTUDIO DEL CURSO:\n${studyMaterial.content}`
      : "";

    const lessonPrompt = `Eres un tutor cercano, paciente y entusiasta. Ensenas a adultos en bachillerato acelerado (PCEI). Tu mision es explicar un tema de forma clara, visual y amigable.

AREA: ${ctx.area}
Tema: ${topicContext}${materialBlock}

ESTILO DE ENSENANZA:
- Habla como un amigo explicando algo nuevo: cercano, animado, sin jerga innecesaria.
- Usa frases como "Imagina que...", "Piensa en esto...", "Vamos paso a paso".
- Maximo 2 oraciones por idea. Se directo y claro.
- Usa ejemplos de la vida cotidiana que cualquier adulto reconozca.

EXPLICACION INICIAL ("explanation"):
- 2-3 oraciones cortas que introduzcan el concepto desde cero.
- Empieza con una pregunta o analogia que conecte con la vida real.

EJEMPLO ("example"):
- Plantea un problema practico y relevante para adultos.
- Cada paso es un objeto con "text" (explicacion) y opcionalmente "svg".
- El SVG debe ser MUY simple: maximo 6 elementos (rect, circle, text, line). viewBox="0 0 260 120".
- Usa colores hexadecimales (#FF6B6B, #4ECDC4, #333). Nada complejo.
- Importante: escapa las comillas dentro del SVG como comillas SIMPLES (comillas simples). Ejemplo: viewBox='0 0 260 120'.
- Incluye "answer" como conclusion clara del ejemplo.

ERROR COMUN ("commonMistake"):
- 1 oracion para el error. 1 oracion para la correccion.

COMPROBACION RAPIDA ("quickCheck"):
- 1 pregunta con 4 opciones. Feedback util en 1 oracion.

REGLAS EJERCICIOS:
- EXACTAMENTE 4 ejercicios.
- Variar tipos: maximo 2 del mismo tipo (mcq, fill_blank, true_false).
- Dificultad variada: al menos 1 easy, 1 medium, 1 hard.
- MCQ: "options" con 4 strings, "correctIndex" (0-3). NO usar "correctAnswer".
- FILL_BLANK: "acceptedAnswers" OBLIGATORIO (array de strings).
- TRUE_FALSE: "correctAnswer" OBLIGATORIO (true o false).
- Hard: "timeLimit": null. Easy/Medium: "timeLimit" entre 20 y 40.`;

    const diagramPrompt = ctx.canHaveDiagram
      ? `Genera un diagrama educativo visual en sintaxis Mermaid.js sobre el tema.

AREA: ${ctx.area}
Tema: ${topicContext}

REGLAS:
- Usa graph TD con nodos A, B, C, D conectados con flechas --> .
- Texto de cada nodo: claro y descriptivo, en espanol.
- Ejemplo: A[Suma] --> B[Resta]
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
          maxOutputTokens: 8000,
          abortSignal: abortController.signal,
        });

        let diagramPromise: Promise<z.infer<typeof diagramSchema> | null> = Promise.resolve(null);
        if (diagramPrompt) {
          const diagramStart = performance.now();
          diagramPromise = (async () => {
            try {
              const r = await generateObject({
                model: aiModel,
                schema: diagramSchema,
                prompt: diagramPrompt,
                temperature: 0.3,
                maxOutputTokens: 1500,
                abortSignal: abortController.signal,
              });
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
            } catch (err) {
              const msg = String((err as any)?.message ?? err ?? "");
              // Fallback to generateText if response_format not supported
              if (msg.includes("response_format") || msg.includes("unavailable")) {
                console.log("[diagram] response_format not supported, falling back to generateText");
                const r = await generateText({
                  model: aiModel,
                  prompt: diagramPrompt + "\n\nResponde SOLO con un JSON valido con dos campos: \"mermaid\" (string con el diagrama) y \"caption\" (string corta).",
                  temperature: 0.3,
                  maxOutputTokens: 1500,
                  abortSignal: abortController.signal,
                });
                logAiCall({
                  route: "practice-diagram-text",
                  model: candidate.modelId,
                  durationMs: Math.round(performance.now() - diagramStart),
                  usage: r.usage ? {
                    inputTokens: r.usage.inputTokens,
                    outputTokens: r.usage.outputTokens,
                    totalTokens: (r.usage.inputTokens ?? 0) + (r.usage.outputTokens ?? 0),
                  } : undefined,
                });
                try {
                  const parsed = tryParseJson(r.text);
                  return { mermaid: parsed.mermaid || "", caption: parsed.caption || "" };
                } catch {
                  console.error("[diagram] failed to parse JSON from generateText");
                  return null;
                }
              }
              console.error("[diagram] failed:", (err as any)?.message || err);
              logAiCall({
                route: "practice-diagram",
                model: candidate.modelId,
                durationMs: Math.round(performance.now() - diagramStart),
                error: (err as any)?.message || "unknown",
              });
              return null;
            }
          })();
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

    if (diagram && isValidMermaid(diagram.mermaid)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (lessonResult.lesson as any).diagram = diagram;
    }

    const [videos] = await Promise.all([
      searchYouTubeVideos(topicContext || topic || ctx.topics[0]),
    ]);

    const videoSearchUrl = buildSearchUrl(topicContext || topic || ctx.topics[0]);

    if (nodeId) {
      const exercisesData = {
        version: CACHED_EXERCISES_VERSION,
        data: { ...lessonResult, videos },
      } as any;

      await db
        .insert(studentExercises)
        .values({
          studentId: user.id,
          nodeId,
          version: CACHED_EXERCISES_VERSION,
          data: exercisesData,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [studentExercises.studentId, studentExercises.nodeId],
          set: {
            version: CACHED_EXERCISES_VERSION,
            data: exercisesData,
            updatedAt: new Date(),
          },
        });
    }

    return Response.json({ ...lessonResult, videos, videoSearchUrl, modelUsed: usedModel.modelId });
  } catch (error) {
    console.error("Generate exercises error:", error);
    return Response.json(
      { error: "Error al generar ejercicios. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
