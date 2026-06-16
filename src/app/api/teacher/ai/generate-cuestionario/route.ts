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

    const REQUEST_TIMEOUT_MS = 60_000;
    const MAX_CANDIDATES = 3;
    let lastError: unknown;
    let usedModel = resolved;

    for (const candidate of candidates.slice(0, MAX_CANDIDATES)) {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

      try {
        const start = Date.now();
        const isTextOnlyProvider = candidate.provider === "groq" || candidate.provider === "deepseek";

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
        usedModel = candidate;

        logAiCall({
          route: "teacher/ai/generate-cuestionario",
          model: candidate.modelId,
          durationMs: Date.now() - start,
        });

        let data;
        try {
          data = tryParseJson(text || "");
          data = normalizeKeys(data);
          if (!data || typeof data !== "object" || !data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
            throw new Error("No se pudieron extraer preguntas del JSON generado");
          }
        } catch (parseErr) {
          console.warn("[generate-cuestionario] JSON parse or validation failed, trying markdown parser...", parseErr);
          const markdownParsed = parseMarkdownToCuestionario(text || "", topic);
          if (markdownParsed && markdownParsed.questions && markdownParsed.questions.length > 0) {
            data = markdownParsed;
          } else {
            lastError = parseErr;
            continue;
          }
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
      } catch (err: any) {
        clearTimeout(timeoutId);
        const msg = String(err?.message || err || "");
        const wasAborted = err?.name === "AbortError" || msg.includes("abort");

        logAiCall({
          route: "teacher/ai/generate-cuestionario",
          model: candidate.modelId,
          durationMs: 0,
          error: wasAborted ? `Timeout (${REQUEST_TIMEOUT_MS / 1000}s)` : (err?.message || "AI error"),
        });

        lastError = err;
        if (!isRetryableModelError(err) && !wasAborted) {
          return NextResponse.json(
            { error: "Error al generar el cuestionario con IA. Intenta de nuevo." },
            { status: 502 }
          );
        }
      }
    }

    if (lastError) {
      const msg = String((lastError as any)?.message || "");
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

function parseMarkdownToCuestionario(text: string, defaultTopic: string): any {
  try {
    const lines = text.split("\n");
    let title = "";
    let descriptionLines: string[] = [];
    const questions: any[] = [];

    let currentSection: "description" | "questions" | "none" = "none";
    let currentQuestion: any = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lowerLine = line.toLowerCase();

      // Detect title
      if (!title) {
        const titleMatch = line.match(/^(?:#+\s*|title\s*:\s*|titulo\s*:\s*)(.+)/i);
        if (titleMatch) {
          title = titleMatch[1].replace(/[\*\`\_]/g, "").trim();
          continue;
        }
      }

      // Section switches
      if (lowerLine.startsWith("descripcion:") || lowerLine.startsWith("description:") || lowerLine.includes("descripci") || lowerLine.includes("description")) {
        currentSection = "description";
        continue;
      }
      if (lowerLine.startsWith("preguntas:") || lowerLine.startsWith("questions:") || lowerLine.includes("pregunta") || lowerLine.includes("question")) {
        currentSection = "questions";
        continue;
      }

      if (currentSection === "description") {
        if (line && !line.startsWith("#")) {
          descriptionLines.push(line);
        }
      } else if (currentSection === "questions") {
        const qMatch = line.match(/^(?:\d+[\.\)]\s*|Pregunta\s+\d+[:\s]*|Question\s+\d+[:\s]*)(.+)/i);
        if (qMatch) {
          if (currentQuestion) {
            questions.push(currentQuestion);
          }
          currentQuestion = {
            type: "mcq",
            question: qMatch[1].trim(),
            options: [],
            correctIndex: 0,
            explanation: "",
            points: 1,
          };
          continue;
        }

        if (currentQuestion) {
          // Detect options
          const optMatch = line.match(/^(?:-\s*|[a-d]\)\s*|[1-4]\.\s*)(.+)/i);
          if (optMatch) {
            currentQuestion.options.push(optMatch[1].trim());
            continue;
          }

          // Detect correctIndex
          if (lowerLine.includes("correct") || lowerLine.includes("respuesta") || lowerLine.includes("indice")) {
            const idxMatch = line.match(/\d+/);
            if (idxMatch) {
              currentQuestion.correctIndex = parseInt(idxMatch[0], 10);
            } else {
              const letterMatch = lowerLine.match(/\b([a-d])\b/);
              if (letterMatch) {
                currentQuestion.correctIndex = letterMatch[1].charCodeAt(0) - 97;
              }
            }
            continue;
          }

          // Detect explanation
          if (lowerLine.startsWith("explanation:") || lowerLine.startsWith("explicacion:") || lowerLine.startsWith("explicación:") || lowerLine.includes("explanation") || lowerLine.includes("explicaci")) {
            const expMatch = line.match(/(?:explanation|explicacion|explicación)[:\s]+(.*)/i);
            if (expMatch) {
              currentQuestion.explanation = expMatch[1].trim();
            }
            continue;
          }

          // Detect type
          if (lowerLine.includes("completar") || lowerLine.includes("blank") || lowerLine.includes("fill")) {
            currentQuestion.type = "completar";
          }
        }
      }
    }

    if (currentQuestion) {
      questions.push(currentQuestion);
    }

    // Default fallbacks
    if (!title) title = "Cuestionario de: " + defaultTopic;
    const description = descriptionLines.join("\n").trim() || "Cuestionario de estudio sobre " + defaultTopic;

    const finalQuestions = questions.map((q, idx) => {
      if (!q.options || q.options.length < 2) {
        q.options = ["Opción A", "Opción B", "Opción C", "Opción D"];
      }
      if (q.correctIndex === undefined || q.correctIndex < 0 || q.correctIndex >= q.options.length) {
        q.correctIndex = 0;
      }
      if (q.question.includes("___")) {
        q.type = "completar";
      }
      q.explanation = q.explanation || "Resolución paso a paso según el tema de estudio.";
      return q;
    });

    if (finalQuestions.length === 0) {
      finalQuestions.push({
        type: "mcq",
        question: "¿Qué es " + defaultTopic + "?",
        options: ["Concepto principal A", "Concepto secundario B", "Alternativa C", "Ninguna de las anteriores"],
        correctIndex: 0,
        explanation: "La alternativa A es la correcta por definición.",
        points: 1,
      });
    }

    return {
      title,
      description,
      questions: finalQuestions,
    };
  } catch (e) {
    console.error("[parseMarkdownToCuestionario] Error parsing markdown fallback:", e);
    return null;
  }
}
