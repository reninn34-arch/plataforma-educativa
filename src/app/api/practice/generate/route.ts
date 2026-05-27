import { NextRequest, NextResponse } from "next/server";
import { opencodeGoModel, diagramModel, logAiCall } from "@/lib/ai";
import { db } from "@/lib/db";
import { nodes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateText } from "ai";
import { z } from "zod/v4";
import { verifyToken } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { practiceGenerateSchema } from "@/lib/api-helpers";

export const CACHED_EXERCISES_VERSION = 2;

const diagramSchema = z.object({
  svg: z.string(),
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

// ── Main prompt: lesson + 4 exercises (NO diagram) ──

const LESSON_PROMPT = `Eres un profesor experto en andragogia para adultos en bachillerato acelerado (PCEI). Genera EXCLUSIVAMENTE un JSON valido con una leccion y 4 ejercicios.

ESTRUCTURA JSON OBLIGATORIA:
{
  "lesson": {
    "title": "Titulo atractivo (max 6 palabras)",
    "explanation": "Explicacion con analogia de la vida real. 3-4 oraciones breves.",
    "example": {
      "problem": "Enunciado del ejemplo con numeros/datos concretos",
      "steps": ["Paso 1: ...", "Paso 2: ..."],
      "answer": "Respuesta final"
    },
    "commonMistake": {
      "description": "Error tipico en UNA oracion",
      "correction": "Como evitarlo en UNA oracion"
    },
    "quickCheck": {
      "question": "Pregunta corta (1 oracion)",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correctIndex": 0,
      "feedback": "Explicacion en 1 oracion"
    }
  },
  "exercises": [EJERCICIO1, EJERCICIO2, EJERCICIO3, EJERCICIO4]
}

REGLAS LECCION (SE BREVE):
1. "explanation": 3-4 oraciones cortas maximo. Desde cero, con analogia de vida real.
2. "example": 2-3 pasos. "answer" en 1 oracion.
3. "commonMistake": 1 oracion description, 1 oracion correction.
4. "quickCheck": 1 oracion question, feedback en 1 oracion.

REGLAS EJERCICIOS:
1. EXACTAMENTE 4 ejercicios. NUNCA menos de 4.
2. Variar tipos: maximo 2 del mismo tipo (mcq, fill_blank, true_false).
3. Dificultad variada: al menos 1 easy, 1 medium, 1 hard.
4. MCQ: 4 opciones, "correctIndex" (0-3). NO usar "correctAnswer".
5. FILL_BLANK: "acceptedAnswers" OBLIGATORIO (array de strings).
6. TRUE_FALSE: "correctAnswer" OBLIGATORIO (true o false).
7. Hard: "timeLimit": null. Easy/Medium: "timeLimit" entre 20 y 40.
8. Lenguaje claro, ejemplos de la vida real.

CRITICO: Responde UNICAMENTE con el JSON. Sin markdown, sin explicaciones, sin texto antes o despues del JSON.`;

// ── Diagram prompt: only the SVG ──

const DIAGRAM_PROMPT = `Eres un disenador grafico educativo. Genera EXCLUSIVAMENTE un JSON con un diagrama SVG para un estudiante adulto.

{
  "svg": "<svg viewBox='0 0 500 300' xmlns='http://www.w3.org/2000/svg'>...</svg>",
  "caption": "Descripcion breve del diagrama"
}

REGLAS:
1. SVG inline valido, responsive (usa viewBox, no width/height fijos).
2. Colores suaves y profesionales. Fondo blanco o transparente.
3. Incluye etiquetas de texto claras con los nombres de los elementos.
4. Usa formas simples: circulos, rectangulos, lineas, flechas, texto.
5. NO uses scripts, eventos, ni CSS externo.
6. NO uses gradientes complejos ni animaciones.
7. El diagrama debe ser auto-contenido y entendible sin contexto adicional.
8. "caption": maximo 6 palabras descriptivas.

CRITICO: Responde UNICAMENTE con el JSON. Sin markdown, sin explicaciones.`;

// ── JSON repair utilities ──

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
  try { return JSON.parse(text); } catch {}
  try { return JSON.parse(repairJson(text)); } catch {}
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try { return JSON.parse(repairJson(text.slice(firstBrace, lastBrace + 1))); } catch {}
  }
  throw new Error("No se pudo extraer JSON valido de la respuesta");
}

// ── POST handler ──

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
    const topicContext = aiPromptContext
      ? `${aiPromptContext}`
      : (topic || ctx.topics.slice(0, 1).join(", "));

    // ── Llamada 1: Leccion + ejercicios ──
    const lessonPromise = generateText({
      model: opencodeGoModel,
      prompt: `${LESSON_PROMPT}\n\nAREA: ${ctx.area}\nTema: ${topicContext}`,
      temperature: 0.6,
      maxOutputTokens: 8000,
    });

    // ── Llamada 2: Diagrama (solo si la materia lo permite, en paralelo) ──
    let diagramPromise: Promise<z.infer<typeof diagramSchema> | null> = Promise.resolve(null);

    if (ctx.canHaveDiagram) {
      const diagramStart = performance.now();
      diagramPromise = generateText({
        model: diagramModel,
        prompt: `${DIAGRAM_PROMPT}\n\nAREA: ${ctx.area}\nTema: ${topicContext}\n\nGenera un diagrama educativo SVG para este tema.`,
        temperature: 0.4,
        maxOutputTokens: 4000,
      }).then((r) => {
        logAiCall({
          route: "practice-diagram",
          model: "deepseek-v4-pro",
          durationMs: Math.round(performance.now() - diagramStart),
          usage: { inputTokens: r.usage?.inputTokens, outputTokens: r.usage?.outputTokens, totalTokens: (r.usage?.inputTokens ?? 0) + (r.usage?.outputTokens ?? 0) },
        });
        try {
          const json = tryParseJson(r.text);
          return diagramSchema.parse(json);
        } catch (e) {
          console.error("[diagram] JSON parse/schema error:", e);
          return null;
        }
      }).catch((err) => {
        console.error("[diagram] generateText failed:", err?.message || err);
        logAiCall({
          route: "practice-diagram",
          model: "deepseek-v4-pro",
          durationMs: Math.round(performance.now() - diagramStart),
          error: err?.message || "unknown",
        });
        return null;
      });
    }

    const startTime = performance.now();

    const [lessonResult, diagram] = await Promise.all([lessonPromise, diagramPromise]);

    const durationMs = Math.round(performance.now() - startTime);

    logAiCall({
      route: "practice-generate",
      model: "kimi-k2.5",
      durationMs,
      usage: { inputTokens: lessonResult.usage?.inputTokens, outputTokens: lessonResult.usage?.outputTokens, totalTokens: (lessonResult.usage?.inputTokens ?? 0) + (lessonResult.usage?.outputTokens ?? 0) },
    });

    const jsonData = tryParseJson(lessonResult.text);
    const parsed = practiceResponseSchema.parse(jsonData);
    parsed.exercises = parsed.exercises.map((ex, i) => ({ ...ex, id: i + 1 }));

    if (diagram) {
      parsed.lesson.diagram = diagram;
    }

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
