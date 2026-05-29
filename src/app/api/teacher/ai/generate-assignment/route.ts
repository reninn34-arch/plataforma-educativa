import { NextRequest, NextResponse } from "next/server";
import { opencodeGoModel, logAiCall } from "@/lib/ai";
import { generateText } from "ai";
import { z } from "zod/v4";
import { verifyToken } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

const mcqQuestionSchema = z.object({
  type: z.literal("mcq"),
  question: z.string().min(1),
  options: z.array(z.string()).length(4),
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
  description: z.string().min(1),
  questions: z.array(z.discriminatedUnion("type", [mcqQuestionSchema, fileUploadQuestionSchema]))
    .min(1)
    .max(15),
});

const GENERATE_PROMPT = `Eres un docente experto creando tareas y evaluaciones para educacion secundaria acelerada de adultos (PCEI en Ecuador). Genera una tarea completa en formato JSON.

DATOS DE ENTRADA:
- Materia (subject)
- Tema (topic)
- Cantidad de preguntas deseada (questionCount)
- Trimestre: 1, 2 o 3

REGLAS:
1. El titulo debe ser claro y descriptivo (max 200 caracteres).
2. La descripcion debe incluir instrucciones claras para el estudiante adulto, contexto practico y relevancia del tema (min 2 parrafos).
3. Las preguntas deben ser variadas: maximo 25% de tipo "file_upload", el resto "mcq". Solo usa "file_upload" si el tema realmente lo amerita (ej: redaccion, ejercicios practicos, graficos).
4. Preguntas MCQ:
   - 4 opciones (A, B, C, D) plausibles, no obvias
   - La opcion correcta debe ser la unica claramente correcta
   - Las distractoras deben ser errores comunes o conceptos relacionados
   - "points": entre 1 y 5, siendo mas altos para preguntas mas complejas
   - "correctIndex": 0 para A, 1 para B, 2 para C, 3 para D
5. Preguntas file_upload:
   - Describe claramente que debe entregar el estudiante
   - "points": entre 5 y 10
6. Lenguaje adaptado a adultos, no infantil. Contexto practico y laboral cuando aplique.
7. IMPORTANTISIMO: Responde UNICAMENTE con JSON puro. La respuesta empieza con { y termina con }. Sin markdown, sin explicaciones.

FORMATO JSON EXACTO:
{
  "title": "Titulo de la tarea",
  "description": "Instrucciones detalladas...",
  "questions": [
    {
      "type": "mcq",
      "question": "¿Cual es la capital de Ecuador?",
      "options": ["Quito", "Guayaquil", "Cuenca", "Manta"],
      "correctIndex": 0,
      "points": 1
    },
    {
      "type": "file_upload",
      "question": "Elabora un mapa conceptual sobre los tipos de energia.",
      "points": 8
    }
  ]
}`;

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

async function repairWithAi(malformed: string): Promise<any> {
  const { text } = await generateText({
    model: opencodeGoModel,
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
    const { subject, topic, questionCount = 5 } = body;

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
    let result: any;

    try {
      const response = await generateText({
        model: opencodeGoModel,
        prompt,
        temperature: 0.6,
        maxOutputTokens: 8000,
      });
      rawText = response.text || "";

      logAiCall({
        route: "teacher/ai/generate-assignment",
        model: "kimi-k2.5",
        durationMs: Date.now() - start,
        usage: response.usage ? {
          inputTokens: response.usage.inputTokens,
          outputTokens: response.usage.outputTokens,
          totalTokens: (response.usage.inputTokens ?? 0) + (response.usage.outputTokens ?? 0),
        } : undefined,
      });
    } catch (aiError: any) {
      logAiCall({
        route: "teacher/ai/generate-assignment",
        model: "kimi-k2.5",
        durationMs: Date.now() - start,
        error: aiError.message || "AI error",
      });
      return NextResponse.json(
        { error: "Error al generar con IA. Intenta de nuevo." },
        { status: 502 }
      );
    }

    try {
      result = tryParseJson(rawText);
    } catch {
      try {
        result = await repairWithAi(rawText);
      } catch {
        return NextResponse.json(
          { error: "La IA genero un formato invalido. Intenta de nuevo con otro tema." },
          { status: 422 }
        );
      }
    }

    const parsed = generateResponseSchema.safeParse(result);
    if (!parsed.success) {
      console.error("[AI Assignment] Schema validation failed:", parsed.error.issues);
      return NextResponse.json(
        { error: "La IA genero datos incompletos. Intenta de nuevo." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      data: parsed.data,
    });
  } catch (error) {
    console.error("Generate assignment error:", error);
    return NextResponse.json(
      { error: "Error al generar la tarea" },
      { status: 500 }
    );
  }
}
