/**
 * @swagger
 * /api/teacher/ai/generate-cuestionario:
 *   post:
 *     summary: Generar cuestionario con IA
 *     description: Utiliza inteligencia artificial para generar un cuestionario de estudio con preguntas de tipo MCQ y completar basado en un tema y materia.
 *     tags: [Docentes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subjectId, topic]
 *             properties:
 *               cursoId:
 *                 type: integer
 *                 description: ID del curso (opcional, para contextualizar con material de estudio)
 *               subjectId:
 *                 type: integer
 *                 description: ID de la materia
 *               topic:
 *                 type: string
 *                 description: Tema del cuestionario
 *               questionCount:
 *                 type: integer
 *                 description: Número de preguntas (3-20, por defecto 5)
 *               questionTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [mcq, completar]
 *                 description: Tipos de pregunta permitidos
 *               model:
 *                 type: string
 *                 description: Modelo de IA a utilizar (opcional)
 *     responses:
 *       200:
 *         description: Cuestionario generado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 title: { type: string }
 *                 description: { type: string }
 *                 questions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       virtualType: { type: string, enum: [mcq, completar] }
 *                       question: { type: string }
 *                       options: { type: array, items: { type: string } }
 *                       correctIndex: { type: integer }
 *                       explanation: { type: string }
 *                       points: { type: integer }
 *                       orderIndex: { type: integer }
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo docentes
 *       422:
 *         description: No se pudieron generar datos válidos
 *       500:
 *         description: Error interno
 *       502:
 *         description: Error del modelo de IA
 *       504:
 *         description: Tiempo de espera agotado
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subjects, studyMaterials } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { getChatModel, getChatModelCandidates, isRetryableModelError, logAiCall, resolveModel, tryParseJson } from "@/lib/ai";
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeKeys(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(normalizeKeys);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    const { cursoId, subjectId, topic, questionCount, questionTypes, model } = await request.json();

    if (!subjectId || !topic?.trim()) {
      return NextResponse.json({ error: "Materia y tema son requeridos" }, { status: 400 });
    }

    const resolved = resolveModel(model);
    if (resolved.error) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }
    const candidates = getChatModelCandidates(model);

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

    const REQUEST_TIMEOUT_MS = 120_000;
    const MAX_CANDIDATES = 3;
    let lastError: unknown;

    for (const candidate of candidates.slice(0, MAX_CANDIDATES)) {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

      try {
        const start = Date.now();
        const isTextOnlyProvider = candidate.provider === "groq" || candidate.provider === "deepseek" || candidate.provider === "opencode";

        let text: string;

        if (isTextOnlyProvider) {
          const r = await generateText({
            model: getChatModel(candidate),
            prompt: aiPrompt + "\n\nResponde SOLO con un JSON valido. No incluyas texto adicional, solo el JSON.",
            temperature: 0.5,
            maxOutputTokens: 4096,
            abortSignal: abortController.signal,
          });
          text = r.text;
        } else {
          const r = await generateText({
            model: getChatModel(candidate),
            prompt: aiPrompt + "\n\nResponde SOLO con un JSON valido. No incluyas texto adicional, solo el JSON.",
            temperature: 0.5,
            maxOutputTokens: 4096,
            abortSignal: abortController.signal,
          });
          text = r.text;
        }

        clearTimeout(timeoutId);

        logAiCall({
          route: "teacher/ai/generate-cuestionario",
          model: candidate.modelId,
          durationMs: Date.now() - start,
        });

        let data = tryParseJson(text || "");
        data = normalizeKeys(data);

        if (!data || typeof data !== "object" || !data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
          lastError = new Error("No se pudieron extraer preguntas del JSON generado");
          continue;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      } catch (error: unknown) {
        clearTimeout(timeoutId);
        const e = error instanceof Error ? error : new Error(String(error));
        const msg = e.message;
        const wasAborted = e.name === "AbortError" || msg.includes("abort");

        logAiCall({
          route: "teacher/ai/generate-cuestionario",
          model: candidate.modelId,
          durationMs: 0,
          error: wasAborted ? `Timeout (${REQUEST_TIMEOUT_MS / 1000}s)` : msg,
        });

        lastError = error;
        if (!isRetryableModelError(error) && !wasAborted) {
          return NextResponse.json(
            { error: "Error al generar el cuestionario con IA. Intenta de nuevo." },
            { status: 502 }
          );
        }
      }
    }

    if (lastError) {
      const msg = String(lastError instanceof Error ? lastError.message : "");
      if (msg.includes("abort") || msg.includes("Timeout")) {
        return NextResponse.json(
          { error: "La generacion excedio el tiempo limite con todos los modelos. Intenta con menos preguntas." },
          { status: 504 }
        );
      }
      return NextResponse.json(
        { error: "No se pudo generar el cuestionario con los modelos configurados." },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: "Ningun modelo pudo generar datos validos. Intenta con otro tema." },
      { status: 422 }
    );
  } catch (error) {
    console.error("[generate-cuestionario] error:", error);
    return NextResponse.json({ error: "Error al generar cuestionario" }, { status: 500 });
  }
}
