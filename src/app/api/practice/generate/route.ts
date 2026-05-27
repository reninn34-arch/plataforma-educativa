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

export const CACHED_EXERCISES_VERSION = 2;

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
  diagram: z.object({
    svg: z.string(),
    caption: z.string(),
  }).optional(),
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

const SUBJECT_CONTEXTS: Record<string, { area: string; topics: string[]; diagramHints: string }> = {
  matematicas: {
    area: "Matematicas - Bachillerato Acelerado para Adultos",
    topics: ["Ecuaciones lineales", "Porcentajes", "Geometria basica", "Fracciones", "Regla de tres", "Algebra elemental", "Area y perimetro", "Operaciones basicas"],
    diagramHints: "SOLO genera diagrama si el tema es GEOMETRIA (figuras, angulos, areas). Para algebra, ecuaciones, fracciones, porcentajes: OMITE el diagrama.",
  },
  fisica: {
    area: "Fisica - Bachillerato Acelerado para Adultos",
    topics: ["Leyes de Newton", "Movimiento rectilineo", "Energia cinetica y potencial", "Ondas y sonido", "Electricidad basica", "Magnetismo", "Calor y temperatura", "Optica"],
    diagramHints: "NO generes diagramas SVG para fisica. Las explicaciones con texto y ejemplos numericos son suficientes. Omite el campo 'diagram'.",
  },
  ingles: {
    area: "Ingles - Bachillerato Acelerado para Adultos",
    topics: ["Verbo To Be", "Presente simple", "Pasado simple", "Futuro con Will", "Vocabulario basico", "Preposiciones", "Adjetivos", "Conversacion basica"],
    diagramHints: "NO generes diagramas SVG para ingles. Omite el campo 'diagram'.",
  },
  quimica: {
    area: "Quimica - Bachillerato Acelerado para Adultos",
    topics: ["Tabla periodica", "Enlaces quimicos", "Reacciones quimicas", "Estados de la materia", "Acidos y bases", "Balanceo de ecuaciones", "Compuestos organicos", "Estequiometria"],
    diagramHints: "NO generes diagramas SVG para quimica. Las explicaciones con texto y ejemplos son suficientes. Omite el campo 'diagram'.",
  },
};

const PROMPT = `Eres un profesor experto en andragogia para adultos en bachillerato acelerado (PCEI). Genera EXCLUSIVAMENTE un JSON valido con una leccion y 4 ejercicios.

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
    "diagram": INCLUIR SOLO PARA GEOMETRIA PURA. Para el resto de temas, OMITIR este campo completamente. Si incluyes, SVG extremadamente simple: maximo 2 formas geometricas y texto. NADA de tablas, circuitos ni estructuras complejas.
    {
      "svg": "<svg viewBox='0 0 200 120' xmlns='http://www.w3.org/2000/svg'><circle cx='60' cy='60' r='30' fill='#e0f0ff' stroke='#333'/><text x='60' y='65' text-anchor='middle' font-size='14'>X</text></svg>",
      "caption": "Descripcion breve"
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

REGLAS LECCION (SE BREVE, CADA TOKEN CUENTA):
1. "explanation": 3-4 oraciones cortas maximo. Desde cero, con analogia de vida real.
2. "example": 2-3 pasos. Concisos. "answer" en 1 oracion.
3. "commonMistake": 1 oracion description, 1 oracion correction.
4. "diagram": OMITELO COMPLETAMENTE a menos que el tema sea GEOMETRIA de figuras. Si lo incluyes: SVG ultra-simple, max 3 elementos (viewBox 200x120). NUNCA incluyas diagramas para: tabla periodica, reacciones, formulas, graficas de funciones, circuitos electricos, ondas, diagramas de cuerpo libre. Esos temas NO llevan diagrama.
5. "quickCheck": 1 oracion question, feedback en 1 oracion.

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
  // Attempt 1: direct parse
  try { return JSON.parse(text); } catch {}
  // Attempt 2: strip markdown + repair brackets
  try { return JSON.parse(repairJson(text)); } catch {}
  // Attempt 3: extract first { ... } block
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try { return JSON.parse(repairJson(text.slice(firstBrace, lastBrace + 1))); } catch {}
  }
  throw new Error("No se pudo extraer JSON valido de la respuesta");
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
    const diagramInfo = ctx.diagramHints ? `\n\nINDICACIONES PARA DIAGRAMAS: ${ctx.diagramHints}` : "";

    const startTime = performance.now();
    const result = await generateText({
      model: opencodeGoModel,
      prompt: `${PROMPT}\n\nAREA: ${ctx.area}${contextInfo}${diagramInfo}`,
      temperature: 0.6,
      maxOutputTokens: 16000,
    });

    logAiCall({
      route: "practice-generate",
      model: "kimi-k2.5",
      durationMs: Math.round(performance.now() - startTime),
      usage: { inputTokens: result.usage?.inputTokens, outputTokens: result.usage?.outputTokens, totalTokens: (result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0) },
    });

    const jsonData = tryParseJson(result.text);
    const parsed = practiceResponseSchema.parse(jsonData);
    parsed.exercises = parsed.exercises.map((ex, i) => ({ ...ex, id: i + 1 }));

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
