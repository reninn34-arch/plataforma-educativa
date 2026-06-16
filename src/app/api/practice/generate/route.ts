import { NextRequest, NextResponse } from "next/server";
import { getChatModel, getChatModelCandidates, isRetryableModelError, logAiCall, resolveModel, tryParseJson } from "@/lib/ai";
import { isValidMermaid, sanitizeMermaid } from "@/lib/mermaid-validate";
import { db } from "@/lib/db";
import { studentExercises } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
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
  if (str === "fill blank" || str.includes("completar") || str.includes("rellenar espacios") || str.includes("completar espacio")) return "fill_blank";
  if (str === "true false" || str.includes("verdadero falso") || str.includes("verdadero o falso")) return "true_false";
  return val;
}, z.enum(["mcq", "fill_blank", "true_false"]));

const exerciseItemSchema = z.preprocess((val: any) => {
  if (val && typeof val === "object") {
    if (val.pregunta && !val.question) val.question = val.pregunta;
    if (val.opciones && !val.options) val.options = val.opciones;
    if ((val.respuestacorrecta || val.correctanswer) && val.correctAnswer === undefined) {
      val.correctAnswer = val.respuestacorrecta ?? val.correctanswer;
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
    const primaryQuery = topic || nodeTitle || cleanContext || ctx.topics[0];
    const videoSearchQuery = `${primaryQuery} ${subject}`;

    const studyMaterial = await getStudyMaterialForStudent(user.id, subject);
    if (studyMaterial) {
      console.log(`[practice] study material found: "${studyMaterial.title}" (${studyMaterial.content.length} chars)`);
    }
    const MAX_MATERIAL_CHARS = 3000;
    const materialContent = studyMaterial
      ? studyMaterial.content.length > MAX_MATERIAL_CHARS
        ? studyMaterial.content.slice(0, MAX_MATERIAL_CHARS) + `\n\n[... contenido truncado de ${studyMaterial.content.length} caracteres. Solo se muestran los primeros ${MAX_MATERIAL_CHARS}.]`
        : studyMaterial.content
      : "";
    const materialBlock = studyMaterial
      ? `\n\nMATERIAL DE ESTUDIO DEL CURSO (basa los ejercicios en este contenido):\n${materialContent}`
      : "";

    const lessonPrompt = isEnglish
      ? `You are a friendly, patient, and enthusiastic tutor. You teach adults in an accelerated high school program (PCEI). Your mission is to explain a topic clearly, visually, and in a friendly way.

All lesson content and exercises MUST be written in ENGLISH.

REQUIRED JSON STRUCTURE (you MUST follow this exact format):
{
  "lesson": {
    "title": "Lesson title",
    "explanation": "Topic explanation...",
    "example": {
      "problem": "Practical problem statement",
      "steps": [{ "text": "Step 1", "svg": "<svg>...</svg>" }, { "text": "Step 2", "svg": "<svg>...</svg>" }],
      "answer": "Final result of the example"
    },
    "commonMistake": "Common mistake and how to fix it",
    "quickCheck": { "question": "Verification question", "options": ["A", "B", "C", "D"], "correctIndex": 0, "feedback": "Brief explanation" }
  },
  "exercises": [
    { "type": "mcq", "question": "...", "options": ["A", "B", "C", "D"], "correctIndex": 0, "difficulty": "easy", "timeLimit": 30 },
    { "type": "fill_blank", "question": "...", "acceptedAnswers": ["answer"], "difficulty": "medium", "timeLimit": 35 },
    { "type": "true_false", "question": "...", "correctAnswer": true, "difficulty": "hard", "timeLimit": null }
  ]
}

AREA: ${ctx.area}
Topic: ${topicContext}${materialBlock}

TEACHING STYLE:
- Talk like a friend explaining something new: warm, encouraging, without unnecessary jargon.
- Use phrases like "Imagine that...", "Think about this...", "Let's go step by step".
- Maximum 2 sentences per idea. Keep it direct and clear.
- Use everyday life examples that any adult would recognize.
- IMPORTANT: The explanation, examples, exercises, and all content MUST be in ENGLISH.

LESSON ("explanation"):
- 2-3 short sentences introducing the concept from scratch.
- Start with a question or analogy that connects to real life.

EXAMPLE ("example"):
- Pose a practical problem relevant to adults.
- EACH step MUST include an "svg" field with an SVG diagram that visually illustrates that step (numbers, lines, geometric shapes, operations).
- The SVG MUST be VERY simple: maximum 6 elements (rect, circle, text, line). viewBox='0 0 260 120'.
- Use ONLY SINGLE quotes inside SVG: viewBox='0 0 260 120', rect x='10' y='10', etc.
- Colors: #FF6B6B, #4ECDC4, #333, #FFD93D. Nothing complex.
- Include "answer" as a clear conclusion of the example.

COMMON MISTAKE ("commonMistake"):
- 1 sentence for the mistake. 1 sentence for the correction.

QUICK CHECK ("quickCheck"):
- 1 question with 4 options. Useful feedback in 1 sentence.

EXERCISE RULES:
- EXACTLY 8 exercises.
- Vary types: maximum 2 of the same type (mcq, fill_blank, true_false).
- Varied difficulty: at least 1 easy, 1 medium, 1 hard.
- MCQ: "options" with 4 strings, "correctIndex" (0-3). DO NOT use "correctAnswer".
- FILL_BLANK: "acceptedAnswers" REQUIRED (array of strings).
- TRUE_FALSE: "correctAnswer" REQUIRED (true or false).
- Hard: "timeLimit": null. Easy/Medium: "timeLimit" between 20 and 40.`
      : `Eres un tutor cercano, paciente y entusiasta. Ensenas a adultos en bachillerato acelerado (PCEI). Tu mision es explicar un tema de forma clara, visual y amigable.

ESTRUCTURA JSON REQUERIDA (DEBES seguir exactamente este formato):
{
  "lesson": {
    "title": "Titulo de la leccion",
    "explanation": "Explicacion del tema...",
    "example": {
      "problem": "Enunciado del problema practico",
      "steps": [{ "text": "Paso 1", "svg": "<svg>...</svg>" }, { "text": "Paso 2", "svg": "<svg>...</svg>" }],
      "answer": "Resultado final del ejemplo"
    },
    "commonMistake": "Error tipico y como corregirlo",
    "quickCheck": { "question": "Pregunta de verificacion", "options": ["A", "B", "C", "D"], "correctIndex": 0, "feedback": "Explicacion breve" }
  },
  "exercises": [
    { "type": "mcq", "question": "...", "options": ["A", "B", "C", "D"], "correctIndex": 0, "difficulty": "easy", "timeLimit": 30 },
    { "type": "fill_blank", "question": "...", "acceptedAnswers": ["respuesta"], "difficulty": "medium", "timeLimit": 35 },
    { "type": "true_false", "question": "...", "correctAnswer": true, "difficulty": "hard", "timeLimit": null }
  ]
}

AREA: ${ctx.area}
Tema: ${topicContext}${materialBlock}

ESTILO DE ENSENANZA:
- Habla como un amigo explicando algo nuevo: cercano, animado, sin jerga innecesaria.
- Usa frases como "Imagina que...", "Piensa en esto...", "Vamos paso a paso".
- Maximo 2 oraciones por idea. Se directo y claro.
- Usa ejemplos de la vida cotidiana que cualquier adulto reconozca.

EXPLICACION INICIAL ("explanation"):
- 2-3 oraciones cortas que introduzcan el concepto desde cero.
- Empieza con una pregunta o analogia que conecte con la vida real.

EJEMPLO ("example"):
- Plantea un problema practico y relevante para adultos.
- CADA paso DEBE incluir un campo "svg" con un diagrama SVG que ilustre visualmente ese paso (numeros, rectas, formas geometricas, operaciones).
- El SVG debe ser MUY simple: maximo 6 elementos (rect, circle, text, line). viewBox='0 0 260 120'.
- Usa SOLO comillas SIMPLES dentro del SVG: viewBox='0 0 260 120', rect x='10' y='10', etc.
- Colores: #FF6B6B, #4ECDC4, #333, #FFD93D. Nada complejo.
- Incluye "answer" como conclusion clara del ejemplo.

ERROR COMUN ("commonMistake"):
- 1 oracion para el error. 1 oracion para la correccion.

COMPROBACION RAPIDA ("quickCheck"):
- 1 pregunta con 4 opciones. Feedback util en 1 oracion.

REGLAS EJERCICIOS:
- EXACTAMENTE 8 ejercicios.
- Variar tipos: maximo 2 del mismo tipo (mcq, fill_blank, true_false).
- Dificultad variada: al menos 1 easy, 1 medium, 1 hard.
- MCQ: "options" con 4 strings, "correctIndex" (0-3). NO usar "correctAnswer".
- FILL_BLANK: "acceptedAnswers" OBLIGATORIO (array de strings).
- TRUE_FALSE: "correctAnswer" OBLIGATORIO (true o false).
- Hard: "timeLimit": null. Easy/Medium: "timeLimit" entre 20 y 40.`;

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

    const LESSON_TIMEOUT_MS = 70_000;
    const DIAGRAM_TIMEOUT_MS = 60_000;
    let lessonResult: z.infer<typeof practiceResponseSchema> | null = null;
    let diagram: z.infer<typeof diagramSchema> | null = null;
    let usedModel = resolved;
    let lastError: unknown;

    for (const candidate of candidates) {
      const lessonAbort = new AbortController();
      const diagramAbort = new AbortController();
      const lessonTimeoutId = setTimeout(() => lessonAbort.abort(), LESSON_TIMEOUT_MS);
      const diagramTimeoutId = setTimeout(() => diagramAbort.abort(), DIAGRAM_TIMEOUT_MS);

      try {
        const aiModel = getChatModel(candidate);
        const isReasoning = candidate.model.toLowerCase().includes("gpt-5") || 
                            candidate.model.toLowerCase().includes("o1") || 
                            candidate.model.toLowerCase().includes("o3") || 
                            candidate.model.toLowerCase().includes("reasoner");

        const startTime = performance.now();

        const isTextOnlyProvider = candidate.provider === "groq" || candidate.provider === "deepseek";

        const lessonPromise = (async () => {
          if (isTextOnlyProvider) {
            const r = await generateText({
              model: aiModel,
              prompt: lessonPrompt + "\n\nResponde UNICAMENTE con un objeto JSON valido estructurado de acuerdo al esquema esperado, sin usar bloques de markdown ni texto adicional.",
              ...(isReasoning ? {} : { temperature: 0.6 }),
              maxOutputTokens: 4096,
              abortSignal: lessonAbort.signal,
            });
            const parsedJson = tryParseJson(r.text);
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
                maxOutputTokens: 4096,
                abortSignal: lessonAbort.signal,
              });
              return { object: r.object, usage: r.usage };
            } catch (objError) {
              console.warn(`[practice-generate] generateObject falló para ${candidate.modelId}, intentando fallback con generateText... Error:`, objError);
              clearTimeout(lessonTimeoutId);
              const fallbackAbort = new AbortController();
              const fallbackTimeout = setTimeout(() => fallbackAbort.abort(), 30_000);
              try {
                const r = await generateText({
                  model: aiModel,
                  prompt: lessonPrompt + "\n\nResponde UNICAMENTE con un objeto JSON valido estructurado de acuerdo al esquema esperado, sin usar bloques de markdown ni texto adicional.",
                  ...(isReasoning ? {} : { temperature: 0.6 }),
                  maxOutputTokens: 4096,
                  abortSignal: fallbackAbort.signal,
                });
                const parsedJson = tryParseJson(r.text);
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
              const r = await generateText({
                model: aiModel,
                prompt: diagramPrompt + "\n\nResponde SOLO con un JSON valido con dos campos: \"mermaid\" (string con el diagrama) y \"caption\" (string corta).",
                ...(isReasoning ? {} : { temperature: 0.3 }),
                maxOutputTokens: 1500,
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
            } else {
              try {
                const r = await generateObject({
                  model: aiModel,
                  schema: diagramSchema,
                  prompt: diagramPrompt,
                  ...(isReasoning ? {} : { temperature: 0.3 }),
                  maxOutputTokens: 1500,
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
                    maxOutputTokens: 1500,
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

    if (diagram && isValidMermaid(diagram.mermaid)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (lessonResult.lesson as any).diagram = diagram;
    }

    const [videos] = await Promise.all([
      searchYouTubeVideos(videoSearchQuery, subject),
    ]);

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

  const graphMatch = raw.match(/(graph\s+(?:TD|LR|TB|RL)[\s\S]*?)(?:\n{2,}|$)/i);
  if (graphMatch) {
    return { mermaid: graphMatch[1].trim(), caption: extractCaptionFromText(raw) };
  }

  return null;
}

function extractCaptionFromText(text: string): string {
  const m = text.match(/caption[:\s]+(.+)/i);
  return m ? m[1].trim() : "";
}
