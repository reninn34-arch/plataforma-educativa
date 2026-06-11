import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subjects, studyMaterials } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { opencodeGoModel, logAiCall, DEFAULT_MODEL_ID, tryParseJson } from "@/lib/ai";
import { generateText } from "ai";

const KEY_MAP: Record<string, string> = {
  titulo: "title", title: "title",
  descripcion: "description", description: "description",
  preguntas: "questions", questions: "questions",
  tipo: "type", type: "type",
  pregunta: "question", question: "question",
  opciones: "options", options: "options",
  indicecorrecto: "correctIndex", correctindex: "correctIndex",
  puntos: "points", points: "points",
  explicacion: "explanation", explanation: "explanation",
};

function normalizeKeys(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(normalizeKeys);
  const result: any = {};
  for (const key of Object.keys(obj)) {
    const clean = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/_/g, "").replace(/\s+/g, "");
    const target = KEY_MAP[clean] || clean;
    result[target] = normalizeKeys(obj[key]);
  }
  return result;
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "Solo docentes" }, { status: 403 });
  }

  try {
    const { cursoId, subjectId, topic, questionCount, questionTypes } = await request.json();

    if (!subjectId || !topic?.trim()) {
      return NextResponse.json({ error: "Materia y tema son requeridos" }, { status: 400 });
    }

    const subjectData = await db.select({ name: subjects.name, slug: subjects.slug }).from(subjects).where(eq(subjects.id, subjectId)).limit(1);
    const subjectName = subjectData[0]?.name || "materia";
    const isEnglish = subjectData[0]?.slug === "ingles";

    const count = Math.min(Math.max(3, questionCount || 5), 20);
    const types = questionTypes || ["mcq", "completar"];

    let studyContent = "";
    if (cursoId) {
      const material = await db
        .select({ title: studyMaterials.title, content: studyMaterials.content })
        .from(studyMaterials)
        .where(and(eq(studyMaterials.cursoId, cursoId), eq(studyMaterials.subjectId, subjectId)))
        .limit(1);
      if (material.length > 0) {
        const raw = material[0].content;
        studyContent = raw.length > 4000
          ? `\n\nMATERIAL DE ESTUDIO (primeros 4000 caracteres):\n${raw.slice(0, 4000)}`
          : `\n\nMATERIAL DE ESTUDIO:\n${raw}`;
      }
    }

    const hasCompletar = types.includes("completar");

    const aiPrompt = isEnglish
      ? `You are an expert teacher creating study questionnaires for secondary education (PCEI Ecuador). Generate a questionnaire in JSON.

Subject: ${subjectName}
Topic: ${topic}
Number of questions: ${count}
${studyContent}

RULES:
1. This questionnaire is for STUDYING, not for evaluation. Include correct answers and explanations.
2. Question types: ${hasCompletar ? "MIX multiple choice (type 'mcq') with FILL-IN-THE-BLANK questions (type 'completar'). For 'completar', the question has a blank space (use ___) and the options include the missing word." : "All questions are multiple choice (type 'mcq')."}
3. type 'mcq': 4 options, correctIndex 0-3, explanation.
4. type 'completar': question with ___ for the blank, 4 options where one completes the phrase, correctIndex 0-3, explanation.
5. If there is study material, base the questions strictly on it.
6. Clear language for adults.
7. IMPORTANT: The questionnaire title, description, questions, options, and all content MUST be in ENGLISH.
8. Respond ONLY with pure JSON. No markdown.

FORMAT:
{
  "title": "Questionnaire: ...",
  "description": "...",
  "questions": [
    { "type": "mcq", "question": "...", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "..." },
    { "type": "completar", "question": "The capital of France is ___", "options": ["Paris","London","Berlin","Madrid"], "correctIndex": 0, "explanation": "..." }
  ]
}`
      : `Eres un docente experto creando cuestionarios de estudio para educacion secundaria (PCEI Ecuador). Genera un cuestionario en JSON.

Materia: ${subjectName}
Tema: ${topic}
Cantidad de preguntas: ${count}
${studyContent}

REGLAS:
1. Este cuestionario es para ESTUDIAR, no para evaluar. Incluye respuestas correctas y explicaciones.
2. Tipos de pregunta: ${hasCompletar ? "MEZCLA preguntas de opcion multiple (type 'mcq') con preguntas de COMPLETAR (type 'completar'). Para 'completar', la pregunta tiene un espacio en blanco (usa ___) y las opciones incluyen la palabra faltante." : "Todas las preguntas son de opcion multiple (type 'mcq')."}
3. type 'mcq': 4 opciones, correctIndex 0-3, explanation.
4. type 'completar': question con ___ para el blanco, 4 opciones donde una completa la frase, correctIndex 0-3, explanation.
5. Si hay material de estudio, basa las preguntas estrictamente en el.
6. Lenguaje claro para adultos.
7. SOLO responde con JSON puro. Sin markdown.

FORMATO:
{
  "title": "Cuestionario: ...",
  "description": "...",
  "questions": [
    { "type": "mcq", "question": "...", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "..." },
    { "type": "completar", "question": "La capital de Francia es ___", "options": ["Paris","Londres","Berlin","Madrid"], "correctIndex": 0, "explanation": "..." }
  ]
}`;

    const start = Date.now();
    const aiResult = await generateText({ model: opencodeGoModel, prompt: aiPrompt, temperature: 0.5, maxOutputTokens: 8000 });
    logAiCall({ route: "ai-tool/generate-cuestionario-form", model: DEFAULT_MODEL_ID, durationMs: Date.now() - start, usage: aiResult.usage ? { inputTokens: aiResult.usage.inputTokens, outputTokens: aiResult.usage.outputTokens, totalTokens: (aiResult.usage.inputTokens ?? 0) + (aiResult.usage.outputTokens ?? 0) } : undefined });

    let data = tryParseJson(aiResult.text || "");
    data = normalizeKeys(data);

    if (!data || typeof data !== "object" || !data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
      return NextResponse.json({ error: "La IA no pudo generar preguntas. Intenta con un tema mas especifico." }, { status: 422 });
    }

    const questions = data.questions.slice(0, 30).map((q: any, i: number) => ({
      virtualType: q.type === "completar" ? "completar" : "mcq",
      question: q.question || "",
      options: q.options || ["", "", "", ""],
      correctIndex: q.correctIndex ?? 0,
      explanation: q.explanation || "",
      points: q.points || 1,
      orderIndex: i,
    }));

    return NextResponse.json({
      title: data.title || `Cuestionario: ${topic}`,
      description: data.description || `Cuestionario de estudio sobre ${topic}`,
      questions,
    });
  } catch (error) {
    console.error("[generate-cuestionario] error:", error);
    return NextResponse.json({ error: "Error al generar cuestionario" }, { status: 500 });
  }
}
