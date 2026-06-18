import { NextRequest, NextResponse } from "next/server";
import { getChatModel, getChatModelCandidates, isRetryableModelError, logAiCall, resolveModel, tryParseJson } from "@/lib/ai";
import { isValidMermaid, sanitizeMermaid } from "@/lib/mermaid-validate";
import { db } from "@/lib/db";
import { studentExercises, nodeVideos, modules, nodes } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { generateObject, generateText } from "ai";
import { z } from "zod/v4";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { practiceGenerateSchema } from "@/lib/api-helpers";
import { searchYouTubeVideos, buildSearchUrl } from "@/lib/youtube";
import { getStudyMaterialForStudent } from "@/lib/study-material";

export const CACHED_EXERCISES_VERSION = 6;

const SCHEMA_KEY_MAP: Record<string, string> = {
  leccion: "lesson",
  ejercicios: "exercises",
  quiz: "exercises",
  test: "exercises",
  examen: "exercises",
  titulo: "title",
  explicacion: "explanation",
  ejemplo: "example",
  problema: "problem",
  pasos: "steps",
  respuesta: "answer",
  errorcomun: "commonMistake",
  error: "commonMistake",
  commonmistake: "commonMistake",
  comprobacionrapida: "quickCheck",
  comprobacion: "quickCheck",
  quickcheck: "quickCheck",
  pregunta: "question",
  opciones: "options",
  respuestacorrecta: "correctAnswer",
  correctanswer: "correctAnswer",
  indicecorrecto: "correctIndex",
  correctindex: "correctIndex",
  respuestasaceptadas: "acceptedAnswers",
  acceptedanswers: "acceptedAnswers",
  limitetiempo: "timeLimit",
  timelimit: "timeLimit",
  dificultad: "difficulty",
  channelname: "channelName",
  thumbnailurl: "thumbnailUrl",
};

function normalizeKeys(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map(normalizeKeys);
  }
  const result: any = {};
  for (const key of Object.keys(obj)) {
    const cleanKey = key
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/_/g, "")
      .replace(/\s+/g, "");
    const targetKey = SCHEMA_KEY_MAP[cleanKey] || cleanKey;
    result[targetKey] = normalizeKeys(obj[key]);
  }
  return result;
}

const diagramSchema = z.object({
  mermaid: z.string(),
  caption: z.string(),
});

const exampleStepSchema = z.preprocess((val: any) => {
  if (val && typeof val === "object" && !val.text && val.description) {
    return { ...val, text: val.description };
  }
  return val;
}, z.object({
  text: z.string(),
  svg: z.string().optional(),
}));

const baseLessonSchema = z.object({
  title: z.string(),
  explanation: z.string(),
  example: z.preprocess((val: any) => {
    if (val && typeof val === "object") {
      const problemText = val.problem ?? val.problema ?? val.text ?? val.pregunta ?? "Ejemplo práctico";
      const answerText = val.answer ?? val.respuesta ?? "Resultado del ejemplo";
      let stepsArray = val.steps ?? val.pasos;

      if (!stepsArray || !Array.isArray(stepsArray)) {
        stepsArray = [{
          text: typeof val.explanation === "string" ? val.explanation : (typeof val.text === "string" ? val.text : "Paso a paso de resolución:"),
          svg: val.svg
        }];
      }
      return {
        problem: problemText,
        steps: stepsArray,
        answer: answerText,
      };
    }
    return val;
  }, z.object({
    problem: z.string(),
    steps: z.array(exampleStepSchema),
    answer: z.string(),
  })),
  commonMistake: z.preprocess((val: any) => {
    if (typeof val === "string") {
      const parts = val.split(/(?:la correccion es|la corrección es|correccion:|corrección:)/i);
      if (parts.length >= 2) {
        return {
          description: parts[0].trim(),
          correction: parts[1].trim(),
        };
      }
      const sentencePeriod = val.indexOf(".");
      if (sentencePeriod > 0 && sentencePeriod < val.length - 1) {
        return {
          description: val.slice(0, sentencePeriod + 1).trim(),
          correction: val.slice(sentencePeriod + 1).trim(),
        };
      }
      return {
        description: val.trim(),
        correction: "Recuerda aplicar el concepto correcto paso a paso.",
      };
    }
    if (val && typeof val === "object") {
      const desc = val.description ?? val.descripcion ?? val.text ?? val.error ?? "Error conceptual común.";
      const corr = val.correction ?? val.correccion ?? val.explicacion ?? "Forma correcta de resolver.";
      return {
        description: desc,
        correction: corr,
      };
    }
    return val;
  }, z.object({
    description: z.string(),
    correction: z.string(),
  })),
  quickCheck: z.preprocess((val: any) => {
    if (val && typeof val === "object") {
      if (val.pregunta && !val.question) val.question = val.pregunta;
      if (val.opciones && !val.options) val.options = val.opciones;
      if ((val.respuestacorrecta || val.indicecorrecto || val.correctindex) && val.correctIndex === undefined) {
        val.correctIndex = val.respuestacorrecta ?? val.indicecorrecto ?? val.correctindex;
      }
      if (Array.isArray(val.options)) {
        if (val.options.length > 4) {
          val.options = val.options.slice(0, 4);
        }
        while (val.options.length < 4) {
          val.options.push(`Opción ${String.fromCharCode(65 + val.options.length)}`);
        }
      }
    }
    return val;
  }, z.object({
    question: z.string(),
    options: z.array(z.string()).length(4),
    correctIndex: z.number().int().min(0).max(3),
    feedback: z.string(),
  })),
});

const lessonSchema = z.preprocess((val: any) => {
  if (val && typeof val === "object") {
    if (val.titulo && !val.title) val.title = val.titulo;
    if (val.explicacion && !val.explanation) val.explanation = val.explicacion;
    if (val.ejemplo && !val.example) val.example = val.ejemplo;
    if ((val.errorcomun || val.error) && !val.commonMistake) {
      val.commonMistake = val.errorcomun || val.error;
    }
    if ((val.comprobacionrapida || val.comprobacion) && !val.quickCheck) {
      val.quickCheck = val.comprobacionrapida || val.comprobacion;
    }
    if (!val.title) {
      val.title = "Lección de Estudio";
    }
  }
  return val;
}, baseLessonSchema);

const difficultySchema = z.preprocess((val) => {
  const str = String(val ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (str.includes("fac") || str.includes("eas") || str.includes("baj") || str.includes("senc") || str.includes("princ") || str.includes("simp") || str === "1") return "easy";
  if (str.includes("med") || str.includes("int") || str.includes("mod") || str.includes("norm") || str === "2") return "medium";
  if (str.includes("dif") || str.includes("har") || str.includes("alt") || str.includes("avanz") || str.includes("comp") || str === "3") return "hard";
  return val;
}, z.enum(["easy", "medium", "hard"]));

const exerciseTypeSchema = z.preprocess((val) => {
  const str = String(val ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .trim();
  if (str === "mcq" || str.includes("opcion multiple") || str.includes("multiple choice") || str.includes("seleccion multiple")) return "mcq";
  if (str.includes("rellenar") || str.includes("completar") || str.includes("fill blank") || str.includes("short answer") || str.includes("completion") || str.includes("completacion")) return "fill_blank";
  if (str === "true false" || str.includes("verdadero falso") || str.includes("verdadero o falso")) return "true_false";
  return "fill_blank";
}, z.enum(["mcq", "fill_blank", "true_false"]));

const exerciseItemSchema = z.preprocess((val: any) => {
  if (val && typeof val === "object") {
    if (val.pregunta && !val.question) val.question = val.pregunta;
    if (val.opciones && !val.options) val.options = val.opciones;
    if ((val.respuestacorrecta || val.correctanswer) && val.correctAnswer === undefined) {
      val.correctAnswer = val.respuestacorrecta ?? val.correctanswer;
    }
    if (val.type !== "true_false" && typeof val.correctAnswer !== "boolean") {
      delete val.correctAnswer;
    }
    if ((val.indicecorrecto || val.correctindex) && val.correctIndex === undefined) {
      val.correctIndex = val.indicecorrecto ?? val.correctindex;
    }
    if ((val.respuestasaceptadas || val.acceptedanswers) && val.acceptedAnswers === undefined) {
      val.acceptedAnswers = val.respuestasaceptadas ?? val.acceptedanswers;
    }
    if ((val.limitetiempo || val.timelimit) && val.timeLimit === undefined) {
      val.timeLimit = val.limitetiempo ?? val.timelimit;
    }
    if (val.dificultad && !val.difficulty) val.difficulty = val.dificultad;
    if (val.timeLimit === undefined) val.timeLimit = null;
  }
  return val;
}, z.object({
  id: z.number().optional().default(0),
  type: exerciseTypeSchema,
  question: z.string(),
  options: z.array(z.string()).optional(),
  correctIndex: z.number().optional(),
  acceptedAnswers: z.array(z.string()).optional(),
  correctAnswer: z.boolean().optional(),
  timeLimit: z.number().nullable(),
  difficulty: difficultySchema,
}));

const videoSchema = z.object({
  id: z.string(),
  title: z.string(),
  channelName: z.string(),
  thumbnailUrl: z.string(),
  duration: z.string(),
});

const practiceResponseSchema = z.preprocess((val: any) => {
  if (val && typeof val === "object") {
    // 1. If it's a flat structure (e.g. title/explanation/ejercicios at root level)
    const hasLessonKeys = val.title || val.titulo || val.explanation || val.explicacion || val.teoria || val.introduction || val.intro;
    const outerLessonKey = Object.keys(val).find(k => {
      const clean = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/_/g, "");
      return (clean === "leccion" || clean === "lesson" || clean === "teoria" || clean === "theory") && typeof val[k] === "object";
    });

    if (!outerLessonKey && hasLessonKeys) {
      val.lesson = {
        title: val.title ?? val.titulo,
        explanation: val.explanation ?? val.explicacion ?? val.introduction ?? val.intro ?? (typeof val.teoria === "string" ? val.teoria : undefined),
        example: val.example ?? val.ejemplo,
        commonMistake: val.commonMistake ?? val.errorcomun ?? val.error_comun ?? val.error,
        quickCheck: val.quickCheck ?? val.comprobacionrapida ?? val.comprobacion_rapida ?? val.comprobacion,
      };
      
      delete val.title;
      delete val.titulo;
      delete val.explanation;
      delete val.explicacion;
      if (typeof val.teoria === "string") delete val.teoria;
      delete val.example;
      delete val.ejemplo;
      delete val.commonMistake;
      delete val.errorcomun;
      delete val.error_comun;
      delete val.error;
      delete val.quickCheck;
      delete val.comprobacionrapida;
      delete val.comprobacion_rapida;
      delete val.comprobacion;
    } else if (outerLessonKey) {
      val.lesson = val[outerLessonKey];
      if (outerLessonKey !== "lesson") {
        delete val[outerLessonKey];
      }
    }

    // If we still have no lesson but have exercises, create a default lesson
    const hasExercises = Object.keys(val).some(k => {
      const clean = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u0300]/g, "").replace(/_/g, "");
      return ["exercises", "ejercicios", "quiz", "test", "examen", "preguntas", "questions"].includes(clean) && Array.isArray(val[k]);
    });
    if (!val.lesson && !outerLessonKey && hasExercises) {
      val.lesson = {
        title: val.title ?? val.titulo ?? "Practica del tema",
        explanation: val.explanation ?? val.explicacion ?? val.introduction ?? val.intro ?? "Repaso del tema",
        example: val.example ?? val.ejemplo ?? { problem: "Ejemplo practico", steps: [{ text: "Paso a paso" }], answer: "Resultado" },
        commonMistake: val.commonMistake ?? val.errorcomun ?? val.error ?? "Error comun",
        quickCheck: val.quickCheck ?? val.comprobacionrapida ?? val.comprobacion ?? { question: "Pregunta rapida", options: ["A", "B", "C", "D"], correctIndex: 0, feedback: "Bien" },
      };
    }
  }

  const normalized = normalizeKeys(val);

  if (normalized && typeof normalized === "object") {
    if (normalized.leccion && !normalized.lesson) normalized.lesson = normalized.leccion;
    if (normalized.ejercicios && !normalized.exercises) normalized.exercises = normalized.ejercicios;
    if (normalized.preguntas && !normalized.exercises) normalized.exercises = normalized.preguntas;
    if (normalized.questions && !normalized.exercises) normalized.exercises = normalized.questions;

    // Extract exercises nested inside lesson object (model sometimes puts them there)
    if (!normalized.exercises && normalized.lesson && typeof normalized.lesson === "object" && Array.isArray((normalized.lesson as any).exercises)) {
      normalized.exercises = (normalized.lesson as any).exercises;
      delete (normalized.lesson as any).exercises;
    }

    // Defensively ensure each exercise has a difficulty and MCQ options are array
    if (Array.isArray(normalized.exercises)) {
      const defaultDiffs = ["easy", "medium", "hard", "medium"];
      normalized.exercises = normalized.exercises.map((ex: any, idx: number) => {
        if (ex && typeof ex === "object") {
          // Coerce empty strings or missing difficulty to varied default difficulties
          if (!ex.difficulty && !ex.dificultad) {
            ex.difficulty = defaultDiffs[idx % defaultDiffs.length];
          }
          // Defensively ensure MCQ questions have correct default settings if missing
          if (ex.type === "mcq") {
            if (!ex.options || !Array.isArray(ex.options)) {
              ex.options = ["Opción A", "Opción B", "Opción C", "Opción D"];
            }
            if (typeof ex.correctIndex !== "number") {
              ex.correctIndex = 0;
            }
          }
          if (ex.type === "true_false") {
            if (typeof ex.correctAnswer !== "boolean") {
              ex.correctAnswer = true;
            }
          }
          if (ex.type === "fill_blank") {
            if (!ex.acceptedAnswers || !Array.isArray(ex.acceptedAnswers)) {
              ex.acceptedAnswers = ["respuesta"];
            }
          }
        }
        return ex;
      });

      // Pad to exactly 8 exercises if model generated fewer (for low-maxOutput models like llama-3.1-8b-instant)
      if (normalized.exercises.length > 8) {
        normalized.exercises = normalized.exercises.slice(0, 8);
      } else if (normalized.exercises.length < 8 && normalized.exercises.length > 0) {
        const originalLength = normalized.exercises.length;
        while (normalized.exercises.length < 8) {
          const copySrc = normalized.exercises[normalized.exercises.length % originalLength];
          normalized.exercises.push({ ...copySrc });
        }
      }
    }
  }
  return normalized;
}, z.object({
  lesson: lessonSchema,
  exercises: z.array(exerciseItemSchema).length(8),
  videos: z.array(videoSchema).default([]),
}));

const cachedLessonSchema = z.preprocess((val: any) => {
  if (val && typeof val === "object") {
    if (val.titulo && !val.title) val.title = val.titulo;
    if (val.explicacion && !val.explanation) val.explanation = val.explicacion;
    if (val.ejemplo && !val.example) val.example = val.ejemplo;
    if ((val.errorComun || val.error_comun || val.error) && !val.commonMistake) {
      val.commonMistake = val.errorComun || val.error_comun || val.error;
    }
    if ((val.comprobacionRapida || val.comprobacion_rapida || val.pregunta_rapida || val.comprobacion) && !val.quickCheck) {
      val.quickCheck = val.comprobacionRapida || val.comprobacion_rapida || val.pregunta_rapida || val.comprobacion;
    }
    if (val.diagrama && !val.diagram) val.diagram = val.diagrama;
  }
  return val;
}, baseLessonSchema.extend({
  diagram: diagramSchema.optional(),
}));

const cachedPracticeResponseSchema = z.object({
  lesson: cachedLessonSchema,
  exercises: z.array(exerciseItemSchema).length(8),
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
    area: "English - Accelerated High School for Adults",
    topics: ["Verb To Be", "Present Simple", "Past Simple", "Future with Will", "Basic Vocabulary", "Prepositions", "Adjectives", "Basic Conversation"],
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
    const rawBody = await request.json();
    const inputParsed = practiceGenerateSchema.safeParse(rawBody);
    if (!inputParsed.success) {
      return Response.json({ error: "Materia requerida" }, { status: 400 });
    }
    const { subject, topic, aiPromptContext, nodeId, retry, model } = inputParsed.data;
    const nodeTitle: string | undefined = rawBody.nodeTitle;

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
    const isEnglish = subject === "ingles";
    const topicContext = aiPromptContext
      ? `${aiPromptContext}`
      : (topic || ctx.topics.slice(0, 1).join(", "));

    const cleanContext = aiPromptContext
      ? aiPromptContext.replace(/^(En este (módulo|tema|nodo|apartado) (aprenderás|veremos|estudiaremos|conocerás|abordaremos) (sobre|acerca de)?\s*)/i, "").slice(0, 100).replace(/\n/g, " ")
      : "";
    const subjectDisplayName: Record<string, string> = {
      matematicas: "matemáticas",
      fisica: "física",
      quimica: "química",
      ingles: "inglés",
    };
    const subjectName = subjectDisplayName[subject] || subject;

    let moduleTopic: string | undefined;
    if (nodeId) {
      try {
        const nodeWithModule = await db
          .select({ topic: modules.topic })
          .from(nodes)
          .innerJoin(modules, eq(nodes.moduleId, modules.id))
          .where(eq(nodes.id, nodeId))
          .limit(1);
        if (nodeWithModule.length > 0 && nodeWithModule[0].topic) {
          moduleTopic = nodeWithModule[0].topic;
        }
      } catch (err) {
        console.warn("[practice] error fetching module topic:", err);
      }
    }

    console.log(`[practice] moduleTopic="${moduleTopic}" nodeTitle="${nodeTitle}"`);

    let videoSearchQuery = cleanContext || nodeTitle || topic || moduleTopic || ctx.topics[0];

    const studyMaterial = await getStudyMaterialForStudent(user.id, subject);
    if (studyMaterial) {
      console.log(`[practice] study material found: "${studyMaterial.title}" (${studyMaterial.content.length} chars)`);
    }
    const MAX_MATERIAL_CHARS = 1500;
    const materialContent = studyMaterial
      ? studyMaterial.content.length > MAX_MATERIAL_CHARS
        ? studyMaterial.content.slice(0, MAX_MATERIAL_CHARS) + `\n\n[... contenido truncado de ${studyMaterial.content.length} caracteres. Solo se muestran los primeros ${MAX_MATERIAL_CHARS}.]`
        : studyMaterial.content
      : "";
    const materialBlock = studyMaterial
      ? `\n\nMATERIAL DE ESTUDIO DEL CURSO (basa los ejercicios en este contenido):\n${materialContent}`
      : "";

    const lessonPrompt = isEnglish
      ? `You are a friendly tutor for adults in accelerated high school (PCEI). Explain topics clearly and visually.

All content MUST be in ENGLISH.

JSON STRUCTURE:
{"lesson":{"title":"","explanation":"","example":{"problem":"","steps":[{"text":"","svg":""}],"answer":""},"commonMistake":"","quickCheck":{"question":"","options":[""],"correctIndex":0,"feedback":""}},"exercises":[{"type":"mcq|fill_blank|true_false","question":"","options":[""],"correctIndex":0,"acceptedAnswers":[""],"correctAnswer":true,"difficulty":"easy|medium|hard","timeLimit":30}]}

RULES:
- Friendly tone, "Imagine that...", max 2 sentences/idea, everyday examples
- explanation: 2-3 sentences, start with question or analogy
- example: practical problem, EACH step MUST include "svg" with REAL SVG markup. Example: "<svg viewBox='0 0 260 120'><rect x='10' y='10' width='50' height='50' fill='#FF6B6B'/><text x='35' y='40' fill='#333'>3</text></svg>" (max 4 elements rect/circle/text/line; use single quotes ONLY inside SVG attrs, JSON string uses double quotes; no xmlns; colors #FF6B6B #4ECDC4 #333 #FFD93D)
- commonMistake: 1 sentence mistake + 1 sentence correction
- quickCheck: 1 question + 4 options, 1 sentence feedback
- EXACTLY 8 exercises. Max 2 per type. At least 1 easy, 1 medium, 1 hard
- MCQ: options[4], correctIndex 0-3. FILL_BLANK: acceptedAnswers[]. TRUE_FALSE: correctAnswer boolean
- Hard: timeLimit null. Easy/Medium: timeLimit 20-40
- Vary the subtopic/focus each time

AREA: ${ctx.area}
Topic: ${topicContext}${materialBlock}

Respond ONLY with valid JSON, no markdown, no extra text.`
      : `Eres un tutor para bachillerato acelerado de adultos (PCEI). Explica claro y visual.

ESTRUCTURA JSON:
{"lesson":{"title":"","explanation":"","example":{"problem":"","steps":[{"text":"","svg":""}],"answer":""},"commonMistake":"","quickCheck":{"question":"","options":[""],"correctIndex":0,"feedback":""}},"exercises":[{"type":"mcq|fill_blank|true_false","question":"","options":[""],"correctIndex":0,"acceptedAnswers":[""],"correctAnswer":true,"difficulty":"easy|medium|hard","timeLimit":30}]}

REGLAS:
- Tono cercano, "Imagina que...", max 2 oraciones/idea, ejemplos cotidianos
- explanation: 2-3 oraciones, empieza con pregunta o analogia
- example: problema practico, CADA paso DEBE incluir "svg" con markup SVG REAL. Ejemplo: "<svg viewBox='0 0 260 120'><rect x='10' y='10' width='50' height='50' fill='#FF6B6B'/><text x='35' y='40' fill='#333'>3</text></svg>" (max 4 elementos rect/circle/text/line; solo comillas simples DENTRO de atributos SVG, el string JSON del SVG usa comillas DOBLES; sin xmlns; colores #FF6B6B #4ECDC4 #333 #FFD93D)
- commonMistake: 1 oracion error + 1 oracion correccion
- quickCheck: 1 pregunta + 4 opciones, feedback 1 oracion
- EXACTAMENTE 8 ejercicios. Max 2 por tipo. Al menos 1 easy, 1 medium, 1 hard
- MCQ: options[4], correctIndex 0-3. FILL_BLANK: acceptedAnswers[]. TRUE_FALSE: correctAnswer booleano
- Hard: timeLimit null. Easy/Medium: timeLimit 20-40
- Varia el subtema cada vez

AREA: ${ctx.area}
Tema: ${topicContext}${materialBlock}

Responde SOLO con JSON valido, sin markdown, sin texto extra.`;

    const diagramPrompt = ctx.canHaveDiagram
      ? `Genera un diagrama educativo visual en sintaxis Mermaid.js sobre el tema.

AREA: ${ctx.area}
Tema: ${topicContext}${materialBlock}

REGLAS:
- Usa graph TD con nodos conectados con flechas --> .
- Texto de cada nodo: solo letras, numeros y espacios. SIN comillas.
- Nodo simple: A[texto del nodo]
- Ejemplo correcto: A[Suma de vectores] --> B[Resultante]
- caption: maximo 6 palabras descriptivas.`
      : null;

    let lessonResult: z.infer<typeof practiceResponseSchema> | null = null;
    let diagram: z.infer<typeof diagramSchema> | null = null;
    let usedModel = resolved;
    let lastError: unknown;

    for (const candidate of candidates) {
      const isTinyGroq = candidate.modelId === "groq:llama-3.1-8b-instant";
      const LESSON_TIMEOUT_MS = isTinyGroq ? 70_000 : 300_000;
      const DIAGRAM_TIMEOUT_MS = isTinyGroq ? 60_000 : 300_000;

      const lessonAbort = new AbortController();
      const diagramAbort = new AbortController();
      const lessonTimeoutId = setTimeout(() => lessonAbort.abort(), LESSON_TIMEOUT_MS);
      const diagramTimeoutId = setTimeout(() => diagramAbort.abort(), DIAGRAM_TIMEOUT_MS);

      try {
        const aiModel = getChatModel(candidate);
        const isReasoning = candidate.model.toLowerCase().includes("gpt-5") || 
                            candidate.model.toLowerCase().includes("o1") || 
                            candidate.model.toLowerCase().includes("o3") || 
                            candidate.model.toLowerCase().includes("reasoner") ||
                            candidate.model.toLowerCase().includes("kimi");

        const startTime = performance.now();

        const isTextOnlyProvider = candidate.provider === "groq" || candidate.provider === "deepseek" || candidate.provider === "opencode";

        const lessonPromise = (async () => {
          if (isTextOnlyProvider) {
            const maxOut = isTinyGroq ? 4096 : 14336;
            const makeTextCall = () => generateText({
              model: aiModel,
              prompt: lessonPrompt + "\n\nResponde UNICAMENTE con un objeto JSON valido estructurado de acuerdo al esquema esperado, sin usar bloques de markdown ni texto adicional.",
              ...(isReasoning ? {} : { temperature: 0.6 }),
              maxOutputTokens: maxOut,
              abortSignal: lessonAbort.signal,
            });

            let r = await makeTextCall();

            if (!r.text || r.text.trim() === "") {
              console.warn(`[practice-generate] respuesta vacia de ${candidate.modelId}, reintentando...`);
              r = await makeTextCall();
            }

            let parsedJson: any;
            try {
              parsedJson = tryParseJson(r.text);
            } catch (parseErr) {
              console.error("[practice-generate] tryParseJson RAW TEXT:", r.text);
              throw parseErr;
            }
            try {
              return { object: practiceResponseSchema.parse(parsedJson), usage: r.usage };
            } catch (zodErr) {
              console.error("[practice-generate] Zod parsing error (fallback textOnly). Raw text:", r.text);
              console.error("[practice-generate] parsedJson:", JSON.stringify(parsedJson, null, 2));
              throw zodErr;
            }
          } else {
            try {
              const r = await generateObject({
                model: aiModel,
                schema: practiceResponseSchema,
                prompt: lessonPrompt,
                ...(isReasoning ? {} : { temperature: 0.6 }),
                maxOutputTokens: isTinyGroq ? 4096 : 14336,
                abortSignal: lessonAbort.signal,
              });
              return { object: r.object, usage: r.usage };
            } catch (objError) {
              console.warn(`[practice-generate] generateObject falló para ${candidate.modelId}, intentando fallback con generateText... Error:`, objError);
              clearTimeout(lessonTimeoutId);
              const fallbackAbort = new AbortController();
              const fallbackTimeout = setTimeout(() => fallbackAbort.abort(), 30_000);
              try {
                const fallbackMaxOut = isTinyGroq ? 4096 : 14336;
                const makeFallbackCall = () => generateText({
                  model: aiModel,
                  prompt: lessonPrompt + "\n\nResponde UNICAMENTE con un objeto JSON valido estructurado de acuerdo al esquema esperado, sin usar bloques de markdown ni texto adicional.",
                  ...(isReasoning ? {} : { temperature: 0.6 }),
                  maxOutputTokens: fallbackMaxOut,
                  abortSignal: fallbackAbort.signal,
                });

                let r = await makeFallbackCall();

                if (!r.text || r.text.trim() === "") {
                  console.warn(`[practice-generate] respuesta vacia en fallback de ${candidate.modelId}, reintentando...`);
                  r = await makeFallbackCall();
                }

                let parsedJson: any;
                try {
                  parsedJson = tryParseJson(r.text);
                } catch (parseErr) {
                  console.error("[practice-generate] tryParseJson RAW TEXT (generateObject fallback):", r.text);
                  throw parseErr;
                }
                try {
                  return { object: practiceResponseSchema.parse(parsedJson), usage: r.usage };
                } catch (zodErr) {
                  console.error("[practice-generate] Zod parsing error (generateObject catch block). Raw text:", r.text);
                  console.error("[practice-generate] parsedJson:", JSON.stringify(parsedJson, null, 2));
                  throw zodErr;
                }
              } finally {
                clearTimeout(fallbackTimeout);
              }
            }
          }
        })();

        let diagramPromise: Promise<z.infer<typeof diagramSchema> | null> = Promise.resolve(null);
        if (diagramPrompt) {
          const diagramStart = performance.now();
          diagramPromise = (async () => {
            if (isTextOnlyProvider) {
              try {
                const r = await generateText({
                  model: aiModel,
                  prompt: diagramPrompt + "\n\nResponde SOLO con un JSON valido con dos campos: \"mermaid\" (string con el diagrama) y \"caption\" (string corta).",
                  ...(isReasoning ? {} : { temperature: 0.3 }),
                  maxOutputTokens: isTinyGroq ? 1500 : 14336,
                  abortSignal: diagramAbort.signal,
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
                  const parsed = extractDiagramFromText(r.text);
                  if (!parsed) throw new Error("No se pudo extraer diagrama");
                  return { mermaid: sanitizeMermaid(parsed.mermaid), caption: parsed.caption };
                } catch {
                  console.error("[diagram] failed to parse JSON from generateText");
                  return null;
                }
              } catch (err) {
                console.warn("[diagram] generateText failed:", (err as any)?.message || err);
                logAiCall({
                  route: "practice-diagram-text",
                  model: candidate.modelId,
                  durationMs: Math.round(performance.now() - diagramStart),
                  error: (err as any)?.message || "unknown",
                });
                return null;
              }
            } else {
              try {
                const r = await generateObject({
                  model: aiModel,
                  schema: diagramSchema,
                  prompt: diagramPrompt,
                  ...(isReasoning ? {} : { temperature: 0.3 }),
                  maxOutputTokens: isTinyGroq ? 1500 : 14336,
                  abortSignal: diagramAbort.signal,
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
                return {
                  mermaid: sanitizeMermaid(r.object.mermaid),
                  caption: r.object.caption,
                };
              } catch (err) {
                console.warn("[diagram] generateObject failed, intentando fallback generateText...", (err as any)?.message || err);
                try {
                  const r = await generateText({
                    model: aiModel,
                    prompt: diagramPrompt + "\n\nResponde SOLO con un JSON valido con dos campos: \"mermaid\" (string con el diagrama) y \"caption\" (string corta).",
                    ...(isReasoning ? {} : { temperature: 0.3 }),
                    maxOutputTokens: isTinyGroq ? 1500 : 14336,
                    abortSignal: diagramAbort.signal,
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
                  const parsed = extractDiagramFromText(r.text);
                  if (!parsed) throw new Error("No se pudo extraer diagrama");
                  return { mermaid: sanitizeMermaid(parsed.mermaid), caption: parsed.caption };
                } catch (textErr) {
                  console.error("[diagram] generateText tambien fallo:", (textErr as any)?.message || textErr);
                  logAiCall({
                    route: "practice-diagram-text",
                    model: candidate.modelId,
                    durationMs: Math.round(performance.now() - diagramStart),
                    error: (textErr as any)?.message || "unknown",
                  });
                  return null;
                }
              }
            }
          })();
        }

        const [lessonAttempt, diagramAttempt] = await Promise.all([lessonPromise, diagramPromise]);
        const durationMs = Math.round(performance.now() - startTime);
        clearTimeout(lessonTimeoutId);
        clearTimeout(diagramTimeoutId);

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
        clearTimeout(lessonTimeoutId);
        clearTimeout(diagramTimeoutId);
        lastError = error;
        const wasAborted = (error as any)?.name === "AbortError" || String((error as any)?.message || "").includes("abort");
        if (!isRetryableModelError(error) && !wasAborted) throw error;
      }
    }

    if (!lessonResult) throw (lastError ?? new Error("No se pudo generar practica con los modelos configurados"));

    lessonResult.exercises = lessonResult.exercises.map((ex, i) => ({ ...ex, id: i + 1 }));

    const generatedTitle = lessonResult.lesson?.title;
    if (generatedTitle) videoSearchQuery = generatedTitle;

    if (diagram && isValidMermaid(diagram.mermaid)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (lessonResult.lesson as any).diagram = diagram;
    }

    // Try to get cached videos for this node (stale after 24h)
    let videos: Awaited<ReturnType<typeof searchYouTubeVideos>> = [];
    const CACHE_VIDEO_HOURS = 24;
    if (nodeId) {
      const cachedVideos = await db
        .select()
        .from(nodeVideos)
        .where(and(
          eq(nodeVideos.nodeId, nodeId),
          sql`${nodeVideos.createdAt} > NOW() - INTERVAL '${sql.raw(String(CACHE_VIDEO_HOURS))} hours'`
        ))
        .orderBy(desc(nodeVideos.createdAt));

      if (cachedVideos.length > 0) {
        videos = cachedVideos.map((v) => ({
          id: v.videoId,
          title: v.title,
          channelName: v.channelName,
          thumbnailUrl: v.thumbnailUrl || "",
          duration: v.duration || "",
          embeddable: v.embeddable,
        }));
        console.log(`[practice] using ${videos.length} cached videos for node ${nodeId}`);
      }
    }

    if (videos.length === 0) {
      [videos] = await Promise.all([
        searchYouTubeVideos(videoSearchQuery, 3, videoSearchQuery),
      ]);

      // Persist videos to nodeVideos cache if we have a nodeId
      if (nodeId && videos.length > 0) {
        await db.insert(nodeVideos).values(
          videos.map((v) => ({
            nodeId,
            videoId: v.id,
            title: v.title,
            channelName: v.channelName,
            thumbnailUrl: v.thumbnailUrl,
            duration: v.duration,
            embeddable: v.embeddable,
          }))
        ).onConflictDoNothing({ target: [nodeVideos.nodeId, nodeVideos.videoId] });
      }
    }

    const videoSearchUrl = buildSearchUrl(videoSearchQuery);

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

function extractDiagramFromText(raw: string): { mermaid: string; caption: string } | null {
  try {
    const parsed = tryParseJson(raw);
    let mermaidStr = (parsed.mermaid || "").replace(/^```(?:mermaid)?\s*\n?/i, "").replace(/\n?```\s*$/, "").trim();
    return { mermaid: mermaidStr, caption: parsed.caption || "" };
  } catch { /* fallback to raw extraction */ }

  const blockMatch = raw.match(/```(?:mermaid)?\s*\n?([\s\S]*?)```/i);
  if (blockMatch) {
    return { mermaid: blockMatch[1].trim(), caption: extractCaptionFromText(raw) };
  }

  const mermaidMatch = raw.match(/((?:graph|flowchart)\s+(?:TD|LR|TB|RL|BT)[\s\S]*?)(?:\n{2,}|$)/i);
  if (mermaidMatch) {
    return { mermaid: mermaidMatch[1].trim(), caption: extractCaptionFromText(raw) };
  }

  return null;
}

function extractCaptionFromText(text: string): string {
  const m = text.match(/caption[:\s]+(.+)/i);
  return m ? m[1].trim() : "";
}
