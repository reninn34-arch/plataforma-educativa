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
    diagramHints: "Genera diagramas SVG para: graficas de funciones, figuras geometricas con medidas, rectas numericas, representacion de fracciones, diagramas de conjuntos.",
  },
  fisica: {
    area: "Fisica - Bachillerato Acelerado para Adultos",
    topics: ["Leyes de Newton", "Movimiento rectilineo", "Energia cinetica y potencial", "Ondas y sonido", "Electricidad basica", "Magnetismo", "Calor y temperatura", "Optica"],
    diagramHints: "Genera diagramas SVG para: diagramas de fuerzas (cuerpo libre), circuitos electricos, ondas sinusoidales, trayectoria de proyectiles, diagramas de reflexion/refraccion.",
  },
  ingles: {
    area: "Ingles - Bachillerato Acelerado para Adultos",
    topics: ["Verbo To Be", "Presente simple", "Pasado simple", "Futuro con Will", "Vocabulario basico", "Preposiciones", "Adjetivos", "Conversacion basica"],
    diagramHints: "NO generes diagramas SVG para ingles. El ingles no se beneficia de graficos tecnicos. Omite el campo 'diagram'.",
  },
  quimica: {
    area: "Quimica - Bachillerato Acelerado para Adultos",
    topics: ["Tabla periodica", "Enlaces quimicos", "Reacciones quimicas", "Estados de la materia", "Acidos y bases", "Balanceo de ecuaciones", "Compuestos organicos", "Estequiometria"],
    diagramHints: "Genera diagramas SVG para: estructuras de Lewis, enlaces quimicos (NaCl, H2O), configuracion electronica, tabla periodica simplificada, diagramas de reacciones, escalas de pH.",
  },
};

const PROMPT = `Eres un profesor experto en andragogia para adultos en bachillerato acelerado (PCEI). Tu tarea es generar una leccion interactiva completa y 4 ejercicios de practica.

ESTRUCTURA DE LA RESPUESTA (JSON):
{
  "lesson": {
    "title": "Titulo atractivo de la leccion (max 8 palabras)",
    "explanation": "Explicacion clara del concepto con analogias de la vida real. Usa lenguaje sencillo. 4-6 oraciones.",
    "example": {
      "problem": "Enunciado del ejemplo practico",
      "steps": ["Paso 1: ...", "Paso 2: ...", "Paso 3: ..."], 
      "answer": "Respuesta final del ejemplo"
    },
    "commonMistake": {
      "description": "Error tipico que cometen los estudiantes",
      "correction": "Por que esta mal y como evitarlo"
    },
    "diagram": OPCIONAL. Solo incluirlo si el tema se beneficia de un grafico (matematicas, fisica, quimica). Si no, omitir completamente.
    {
      "svg": "<svg viewBox='0 0 400 200' xmlns='http://www.w3.org/2000/svg'>...</svg>",
      "caption": "Descripcion breve del grafico"
    },
    "quickCheck": {
      "question": "Pregunta corta de comprobacion (1 oracion)",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correctIndex": 0,
      "feedback": "Explicacion de por que esa es la respuesta correcta (1-2 oraciones)"
    }
  },
  "exercises": [ ... 4 ejercicios ... ]
}

REGLAS PARA LA LECCION:
1. "explanation": Explica el concepto DESDE CERO, asumiendo que el estudiante no sabe nada del tema.
2. "example": Usa un ejemplo CONCRETO con numeros/datos reales. Los pasos deben ser logicos y progresivos.
3. "commonMistake": Describe un error REAL que cometen los adultos al aprender este tema.
4. "diagram": SOLO para temas visuales (geometria, fuerzas, tabla periodica, circuitos, graficas). Usa SVG inline valido. Colores suaves. NO uses scripts ni eventos. Si no aplica, OMITE el campo "diagram" completamente.
5. "quickCheck": Pregunta FACIL que verifica comprension basica. NO uses la misma pregunta que en los ejercicios.

REGLAS PARA LOS EJERCICIOS:
1. EXACTAMENTE 4 ejercicios.
2. Variar tipos: maximo 2 del mismo tipo (mcq, fill_blank, true_false).
3. Dificultad variada: al menos 1 easy, 1 medium, 1 hard.
4. MCQ: 4 opciones, "correctIndex" (0-3). NO uses "correctAnswer".
5. FILL_BLANK: "acceptedAnswers" OBLIGATORIO (array de strings con todas las respuestas aceptables).
6. TRUE_FALSE: "correctAnswer" OBLIGATORIO (true o false).
7. Hard: "timeLimit": null. Easy/Medium: "timeLimit" entre 20 y 40 segundos.
8. Lenguaje claro, ejemplos de la vida real, sin jerga innecesaria.

IMPORTANTE: Responde UNICAMENTE con el JSON valido. Sin markdown, sin texto adicional.`;

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
    const diagramInfo = ctx.diagramHints ? `\n\nINDICACIONES PARA DIAGRAMAS: ${ctx.diagramHints}` : "";

    const startTime = performance.now();
    const result = await generateText({
      model: opencodeGoModel,
      prompt: `${PROMPT}\n\nAREA: ${ctx.area}${contextInfo}${diagramInfo}`,
      temperature: 0.8,
      maxOutputTokens: 8000,
    });

    logAiCall({
      route: "practice-generate",
      model: "kimi-k2.5",
      durationMs: Math.round(performance.now() - startTime),
      usage: { inputTokens: result.usage?.inputTokens, outputTokens: result.usage?.outputTokens, totalTokens: (result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0) },
    });

    const text = repairJson(result.text);
    const parsed = practiceResponseSchema.parse(JSON.parse(text));
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
