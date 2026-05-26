import { NextRequest } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod/v4";

const exerciseSchema = z.object({
  exercises: z.array(z.object({
    id: z.number(),
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

const SUBJECT_CONTEXTS: Record<string, { area: string; topics: string[] }> = {
  matematicas: {
    area: "Matematicas - Bachillerato Acelerado para Adultos",
    topics: ["Ecuaciones lineales", "Porcentajes", "Geometria basica", "Fracciones", "Regla de tres", "Algebra elemental", "Area y perimetro", "Operaciones basicas"],
  },
  lenguaje: {
    area: "Lenguaje y Literatura - Bachillerato Acelerado para Adultos",
    topics: ["Ortografia", "Gramatica basica", "Comprension lectora", "Tipos de textos", "Sinonimos y antonimos", "Sujeto y predicado", "Signos de puntuacion", "Redaccion"],
  },
  ciencias: {
    area: "Ciencias Naturales - Bachillerato Acelerado para Adultos",
    topics: ["Celula", "Sistema solar", "Fotosintesis", "Estados de la materia", "Cadena alimenticia", "Ciclo del agua", "Cuerpo humano", "Energia"],
  },
  sociales: {
    area: "Ciencias Sociales - Bachillerato Acelerado para Adultos",
    topics: ["Geografia del Ecuador", "Historia del Ecuador", "Derechos humanos", "Constitucion", "Democracia", "Culturas precolombinas", "Independencia", "Educacion civica"],
  },
};

const PROMPT = `Eres un generador de ejercicios educativos para adultos en bachillerato acelerado (PCEI).
Genera EXACTAMENTE 5 ejercicios en formato JSON.

REGLAS ESTRICTAS:
1. Lenguaje claro y sencillo, sin jerga tecnica innecesaria.
2. Los ejercicios deben ser practicos y aplicables a la vida real.
3. Variar entre: mcq (opcion multiple), fill_blank (completar), true_false (verdadero/falso).
4. Para mcq: incluir 4 opciones y el indice de la correcta (0-3).
5. Para fill_blank: incluir un array de respuestas aceptables.
6. Para true_false: incluir la respuesta correcta (true/false).
7. Los ejercicios "hard" no llevan limite de tiempo (timeLimit: null).
8. Los ejercicios "easy" y "medium" tienen timeLimit en segundos (20-40s).
9. Alternar tipos: maximo 2 del mismo tipo.
10. Incluir dificultad variada: al menos 1 easy, 1 medium, 1 hard.`;

export async function POST(request: NextRequest) {
  try {
    const { subject, topic } = await request.json();

    const ctx = SUBJECT_CONTEXTS[subject] || SUBJECT_CONTEXTS.matematicas;
    const topicStr = topic ? `\nTema especifico: ${topic}.` : `\nTemas sugeridos: ${ctx.topics.slice(0, 4).join(", ")}.`;

    const result = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: exerciseSchema,
      prompt: `${PROMPT}\n\nAREA: ${ctx.area}${topicStr}`,
      temperature: 0.8,
      maxOutputTokens: 1500,
    });

    return Response.json(result.object);
  } catch (error) {
    console.error("Generate exercises error:", error);
    return Response.json(
      { error: "Error al generar ejercicios. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
