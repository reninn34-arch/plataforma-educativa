import { NextRequest, NextResponse } from "next/server";
import { opencodeGoModel, logAiCall } from "@/lib/ai";
import { db } from "@/lib/db";
import { nodes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateText } from "ai";
import { z } from "zod/v4";
import { verifyToken } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { practiceGenerateSchema } from "@/lib/api-helpers";

export const CACHED_EXERCISES_VERSION = 1;

const exerciseSchema = z.object({
  concept_bites: z.array(z.string()),
  exercises: z.array(z.object({
    id: z.number().optional().default(0),
    type: z.enum(["mcq", "fill_blank", "true_false"]),
    question: z.string(),
    options: z.array(z.string()).optional(),
    correctIndex: z.number().optional(),
    acceptedAnswers: z.array(z.string()).optional(),
    correctAnswer: z.boolean().optional(),
    timeLimit: z.number().nullable(),
    difficulty: z.enum(["easy", "medium", "hard"]),
  })),
});

const cachedExercisesSchema = z.object({
  version: z.number(),
  data: exerciseSchema,
});

const SUBJECT_CONTEXTS: Record<string, { area: string; topics: string[] }> = {
  matematicas: {
    area: "Matematicas - Bachillerato Acelerado para Adultos",
    topics: ["Ecuaciones lineales", "Porcentajes", "Geometria basica", "Fracciones", "Regla de tres", "Algebra elemental", "Area y perimetro", "Operaciones basicas"],
  },
  fisica: {
    area: "Fisica - Bachillerato Acelerado para Adultos",
    topics: ["Leyes de Newton", "Movimiento rectilineo", "Energia cinetica y potencial", "Ondas y sonido", "Electricidad basica", "Magnetismo", "Calor y temperatura", "Optica"],
  },
  ingles: {
    area: "Ingles - Bachillerato Acelerado para Adultos",
    topics: ["Verbo To Be", "Presente simple", "Pasado simple", "Futuro con Will", "Vocabulario basico", "Preposiciones", "Adjetivos", "Conversacion basica"],
  },
  quimica: {
    area: "Quimica - Bachillerato Acelerado para Adultos",
    topics: ["Tabla periodica", "Enlaces quimicos", "Reacciones quimicas", "Estados de la materia", "Acidos y bases", "Balanceo de ecuaciones", "Compuestos organicos", "Estequiometria"],
  },
};

const PROMPT = `Eres un diseñador de niveles educativos (Learning Path) para adultos en bachillerato acelerado (PCEI).
Tu objetivo es generar una micro-lección (Bite-sized Learning) y EXACTAMENTE 4 ejercicios practicos en formato JSON basados en el contexto proveido.

REGLAS ESTRICTAS:
1. Genera primero "concept_bites": un arreglo de 2 a 3 oraciones cortas (tarjetas) que expliquen de forma muy sencilla el concepto clave.
2. Lenguaje claro y sencillo, sin jerga tecnica innecesaria.
3. Los ejercicios deben ser practicos y aplicables a la vida real.
4. Variar entre: mcq (opcion multiple), fill_blank (completar), true_false (verdadero/falso).
5. Para mcq: incluir 4 opciones y "correctIndex" (numero 0-3) indicando cual es la correcta. NO uses "correctAnswer" para mcq.
6. Para fill_blank: "acceptedAnswers" es OBLIGATORIO. Incluir un array con todas las respuestas aceptables (ej: ["am", "is", "are"]). NO uses "correctAnswer" ni "correctIndex" para fill_blank.
7. Para true_false: "correctAnswer" es OBLIGATORIO (true o false).
8. Los ejercicios "hard" llevan timeLimit: null (sin tiempo).
9. Los ejercicios "easy" y "medium": "timeLimit" es OBLIGATORIO, un numero entre 20 y 40 segundos.
10. Alternar tipos: maximo 2 del mismo tipo.
11. Incluir dificultad variada: al menos 1 easy, 1 medium, 1 hard.
12. Responde UNICAMENTE con JSON valido. No uses bloques de markdown ni texto adicional. Solo el JSON puro.`;

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

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const inputParsed = practiceGenerateSchema.safeParse(await request.json());
    if (!inputParsed.success) {
      return Response.json({ error: "Materia requerida" }, { status: 400 });
    }
    const { subject, topic, aiPromptContext, nodeId, retry } = inputParsed.data;

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
    const contextInfo = aiPromptContext 
      ? `\nContexto Especifico del Nodo: ${aiPromptContext}`
      : (topic ? `\nTema especifico: ${topic}.` : `\nTemas sugeridos: ${ctx.topics.slice(0, 4).join(", ")}.`);

    const startTime = performance.now();
    const result = await generateText({
      model: opencodeGoModel,
      prompt: `${PROMPT}\n\nAREA: ${ctx.area}${contextInfo}`,
      temperature: 0.8,
      maxOutputTokens: 6000,
    });

    logAiCall({
      route: "practice-generate",
      model: "kimi-k2.5",
      durationMs: Math.round(performance.now() - startTime),
      usage: { inputTokens: result.usage?.inputTokens, outputTokens: result.usage?.outputTokens, totalTokens: (result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0) },
    });

    const text = repairJson(result.text);
    const parsed = exerciseSchema.parse(JSON.parse(text));
    parsed.exercises = parsed.exercises.map((ex: z.infer<typeof exerciseSchema>["exercises"][number], i: number) => ({ ...ex, id: i + 1 }));

    if (nodeId) {
      await db
        .update(nodes)
        .set({
          cachedExercises: {
            version: CACHED_EXERCISES_VERSION,
            data: parsed,
          } as any,
        })
        .where(eq(nodes.id, nodeId));
    }

    return Response.json(parsed);
  } catch (error) {
    console.error("Generate exercises error:", error);
    return Response.json(
      { error: "Error al generar ejercicios. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
