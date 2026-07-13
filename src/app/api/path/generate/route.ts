/**
 * @swagger
 * /api/path/generate:
 *   post:
 *     summary: Generar camino de aprendizaje
 *     description: Genera un Learning Path personalizado con IA (módulo + nodos) para una materia y tema. Detecta duplicados semánticos y reutiliza módulos existentes.
 *     tags: [Práctica e IA]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subject, topic]
 *             properties:
 *               subject:
 *                 type: string
 *                 description: Slug de la materia
 *               topic:
 *                 type: string
 *                 minLength: 3
 *                 description: Tema del camino de aprendizaje
 *               model:
 *                 type: string
 *                 description: Identificador del modelo de IA
 *     responses:
 *       200:
 *         description: Camino de aprendizaje generado o recuperado de caché
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 module:
 *                   type: object
 *                 nodes:
 *                   type: array
 *                 cached:
 *                   type: boolean
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo estudiantes
 *       404:
 *         description: Materia no encontrada
 *       500:
 *         description: Error interno
 */
import { NextRequest } from "next/server";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { subjects, modules, nodes, studentModules } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getChatModel, getChatModelCandidates, isRetryableModelError, logAiCall, resolveModel, tryParseJson, generateEmbedding, cosineSimilarity } from "@/lib/ai";
import { generateObject, generateText } from "ai";
import { z } from "zod/v4";
import { rateLimit } from "@/lib/rate-limit";
import { pathGenerateSchema } from "@/lib/api-helpers";
import { getStudyMaterialForStudent } from "@/lib/study-material";

const nodeTypeSchema = z.preprocess((val) => {
  if (typeof val === "string") {
    const clean = val.toLowerCase().trim();
    if (clean === "concept" || clean === "concepto" || clean === "teoria" || clean === "teoría") return "concept";
    if (clean === "quiz" || clean === "cuestionario" || clean === "evaluacion" || clean === "evaluación") return "quiz";
    if (clean === "challenge" || clean === "desafio" || clean === "desafío" || clean === "practica" || clean === "práctica") return "challenge";
  }
  return val;
}, z.enum(["concept", "quiz", "challenge"]));

const nodeSchema = z.object({
  title: z.string(),
  type: nodeTypeSchema,
  aiPromptContext: z.string(),
});

const pathSchema = z.object({
  moduleTitle: z.string(),
  nodes: z.array(nodeSchema),
});

const SUBJECT_META: Record<string, string> = {
  matematicas: "Matematicas - Bachillerato Acelerado para Adultos (PCEI)",
  fisica: "Fisica - Bachillerato Acelerado para Adultos (PCEI)",
  ingles: "Ingles - Bachillerato Acelerado para Adultos (PCEI)",
  quimica: "Quimica - Bachillerato Acelerado para Adultos (PCEI)",
};

function normalizeTopic(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "student") {
    return Response.json({ error: "Solo estudiantes" }, { status: 403 });
  }

  try {
    const inputParsed = pathGenerateSchema.safeParse(await request.json());
    if (!inputParsed.success) {
      return Response.json({ error: "Materia y tema (min 3 caracteres) requeridos" }, { status: 400 });
    }
    const { subject: subjectSlug, topic, model } = inputParsed.data;

    const resolved = resolveModel(model);
    if (resolved.error) {
      return Response.json({ error: resolved.error }, { status: 400 });
    }
    const candidates = getChatModelCandidates(model);

    const rl = rateLimit({ key: `path-gen:${user.id}`, maxRequests: 10, windowMs: 60_000 });
    if (rl) return rl;

    const subjectRecord = await db
      .select()
      .from(subjects)
      .where(eq(subjects.slug, subjectSlug))
      .limit(1);
    if (!subjectRecord.length) {
      return Response.json({ error: "Materia no encontrada" }, { status: 404 });
    }
    const subject = subjectRecord[0];
    const areaContext = SUBJECT_META[subjectSlug] || subject.name;

    const studyMaterial = await getStudyMaterialForStudent(user.id, subjectSlug);
    if (studyMaterial) {
      console.log(`[path] study material found: "${studyMaterial.title}" (${studyMaterial.content.length} chars)`);
    }
    const MAX_MATERIAL_CHARS = 3000;
    const materialContent = studyMaterial
      ? studyMaterial.content.length > MAX_MATERIAL_CHARS
        ? studyMaterial.content.slice(0, MAX_MATERIAL_CHARS) + `\n\n[... contenido truncado de ${studyMaterial.content.length} caracteres. Solo se muestran los primeros ${MAX_MATERIAL_CHARS}.]`
        : studyMaterial.content
      : "";
    const materialBlock = studyMaterial
      ? `\n\nMATERIAL DE ESTUDIO DEL CURSO (basa los nodos en este contenido):\n${materialContent}`
      : "";

    const systemPrompt = `Eres un disenador curricular experto en andragogia para adultos en bachillerato acelerado (PCEI).
Genera un "Learning Path" (camino de aprendizaje) sobre un tema especifico.

REGLAS:
- Genera entre 6 y 8 nodos de aprendizaje en total.
- Los primeros 3-4 nodos tipo "concept" (ensenanza teorica).
- Los ultimos 3-4 nodos tipo "quiz" o "challenge" (practica y evaluacion).
- CADA NODO debe cubrir un SUBTEMA DIFERENTE y NO SOLAPADO del tema principal. NO repitas titulos ni contenidos entre nodos. Si dos subtemas se parecen, COMBINALOS en uno solo.
- Ejemplo para "Movimiento Rectilineo": N1: "MRU vs MRUA", N2: "Graficas velocidad-tiempo", N3: "Caida libre como MRUA", N4: "Ejercicios MRU", N5: "Ejercicios MRUA", N6: "Desafio problemas combinados", N7: "Evaluacion MRU/MRUA".
- Cada nodo: "title" corto (max 6 palabras) y DISTINTO a los demas, "type" segun corresponda, "aiPromptContext" detallado (2-3 oraciones) enfocado en su subtema especifico y UNICO.
- Contenido apropiado para adultos que retoman sus estudios, con ejemplos practicos de la vida real.
- Progresion de dificultad: de lo mas basico a lo mas avanzado.
- "moduleTitle": titulo descriptivo del camino completo.
- IMPORTANTE: Asegurate de que cada nodo tenga un enfoque UNICO. Si el mismo subtema aparece en dos nodos diferentes, es un error. Cada nodo debe ser claramente distinguible de los demas.`;

    const startTime = performance.now();
    let outputParsed: z.infer<typeof pathSchema> | null = null;
    let usedModel = resolved;
    let lastError: unknown;
    const REQUEST_TIMEOUT_MS = 120_000;
    const MAX_CANDIDATES = 3;

    for (const candidate of candidates.slice(0, MAX_CANDIDATES)) {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

      try {
        const isReasoning = candidate.model.toLowerCase().includes("gpt-5") || 
                            candidate.model.toLowerCase().includes("o1") || 
                            candidate.model.toLowerCase().includes("o3") || 
                            candidate.model.toLowerCase().includes("reasoner");

        const isTextOnlyProvider = candidate.provider === "groq" || candidate.provider === "deepseek" || candidate.provider === "opencode";

        const promptText = isReasoning
          ? `${systemPrompt}\n\nAREA: ${areaContext}\nTEMA SOLICITADO POR EL ESTUDIANTE: "${topic}"${materialBlock}\n\nGenera un Learning Path de 6-8 nodos para este tema, basandote en el MATERIAL DE ESTUDIO DEL CURSO proporcionado. Los primeros nodos deben ser de tipo "concept" (ensenanza) y los ultimos de tipo "quiz" o "challenge" (practica).`
          : `AREA: ${areaContext}\nTEMA SOLICITADO POR EL ESTUDIANTE: "${topic}"${materialBlock}\n\nGenera un Learning Path de 6-8 nodos para este tema, basandote en el MATERIAL DE ESTUDIO DEL CURSO proporcionado. Los primeros nodos deben ser de tipo "concept" (ensenanza) y los ultimos de tipo "quiz" o "challenge" (practica).`;

        if (isTextOnlyProvider) {
          const fallbackPrompt = promptText + "\n\nResponde UNICAMENTE con un objeto JSON valido que coincida con el esquema esperado:\n{\"moduleTitle\": string, \"nodes\": [{\"title\": string, \"type\": \"concept\"|\"quiz\"|\"challenge\", \"aiPromptContext\": string}]}. No uses bloques de markdown ni texto adicional.";
          const responseText = await generateText({
            model: getChatModel(candidate),
            prompt: fallbackPrompt,
            ...(isReasoning ? {} : { system: systemPrompt, temperature: 0.8 }),
            maxOutputTokens: 4000,
            abortSignal: abortController.signal,
          });
          const parsed = tryParseJson(responseText.text);
          outputParsed = pathSchema.parse(parsed);
        } else {
          try {
            const response = await generateObject({
              model: getChatModel(candidate),
              schema: pathSchema,
              prompt: promptText,
              ...(isReasoning ? {} : { system: systemPrompt, temperature: 0.8 }),
              maxOutputTokens: 4000,
              abortSignal: abortController.signal,
            });
            outputParsed = response.object;
          } catch (objError) {
            console.warn(`[path-generate] generateObject falló para ${candidate.modelId}, intentando fallback con generateText... Error:`, objError);
            const fallbackPrompt = promptText + "\n\nResponde UNICAMENTE con un objeto JSON valido que coincida con el esquema esperado:\n{\"moduleTitle\": string, \"nodes\": [{\"title\": string, \"type\": \"concept\"|\"quiz\"|\"challenge\", \"aiPromptContext\": string}]}. No uses bloques de markdown ni texto adicional.";
            const responseText = await generateText({
              model: getChatModel(candidate),
              prompt: fallbackPrompt,
              ...(isReasoning ? {} : { system: systemPrompt, temperature: 0.8 }),
              maxOutputTokens: 4000,
              abortSignal: abortController.signal,
            });
            const parsed = tryParseJson(responseText.text);
            outputParsed = pathSchema.parse(parsed);
          }
        }
        clearTimeout(timeoutId);
        usedModel = candidate;
        break;
      } catch (error) {
        clearTimeout(timeoutId);

        const msg = String(error instanceof Error ? error.message : error || "");
        if (msg.includes("response_format") || msg.includes("unavailable")) {
          try {
            const textResponse = await generateText({
              model: getChatModel(candidate),
              system: systemPrompt,
              prompt: `AREA: ${areaContext}
TEMA SOLICITADO POR EL ESTUDIANTE: "${topic}"${materialBlock}

Genera un Learning Path de 6-8 nodos para este tema, basandote en el MATERIAL DE ESTUDIO DEL CURSO proporcionado. Los primeros nodos deben ser de tipo "concept" (ensenanza) y los ultimos de tipo "quiz" o "challenge" (practica).

Responde SOLO con un JSON valido con la siguiente estructura:
{
  "moduleTitle": "string",
  "nodes": [
    { "title": "string", "type": "concept|quiz|challenge", "aiPromptContext": "string" }
  ]
}`,
              temperature: 0.8,
              maxOutputTokens: 4000,
              abortSignal: abortController.signal,
            });

            try {
              const parsed = tryParseJson(textResponse.text);
              const validated = pathSchema.parse(parsed);
              outputParsed = validated;
              usedModel = candidate;
              break;
            } catch (parseError) {
              lastError = parseError;
              continue;
            }
          } catch (textModelError) {
            lastError = textModelError;
            if (!isRetryableModelError(textModelError)) throw textModelError;
            continue;
          }
        }

        lastError = error;
        if (!isRetryableModelError(error)) throw error;
      }
    }

    if (!outputParsed) throw (lastError ?? new Error("No se pudo generar el learning path con los modelos configurados"));

    logAiCall({
      route: "path-generate",
      model: usedModel.modelId,
      durationMs: Math.round(performance.now() - startTime),
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    });


    const { moduleTitle, nodes: aiNodes } = outputParsed;

    // Check for duplicate by normalized topic + subject
    const normalizedTopic = normalizeTopic(topic);
    const subjectModules = await db
      .select()
      .from(modules)
      .where(eq(modules.subjectId, subject.id));

    let matchedModule = subjectModules.find(
      (m) => m.topic && normalizeTopic(m.topic) === normalizedTopic
    );

    // If no exact match, try semantic similarity with embeddings
    if (!matchedModule && subjectModules.some((m) => m.topic && m.topicEmbedding)) {
      try {
        const newEmbedding = await generateEmbedding(topic);
        const SEMANTIC_THRESHOLD = 0.85;
        let bestScore = 0;
        for (const m of subjectModules) {
          if (m.topic && m.topicEmbedding) {
            const score = cosineSimilarity(newEmbedding.embedding, m.topicEmbedding as number[]);
            if (score > bestScore) {
              bestScore = score;
              if (score >= SEMANTIC_THRESHOLD) {
                matchedModule = m;
              }
            }
          }
        }
        if (matchedModule) {
          console.log(`[path] semantic duplicate found: topic="${topic}" matches module #${matchedModule.id} topic="${matchedModule.topic}" (score=${bestScore.toFixed(3)})`);
        }
      } catch (err) {
        console.warn("[path] embedding similarity check failed, falling back to exact match only:", err);
      }
    }

    if (matchedModule) {
      // Link current student to this module if not already linked
      const existingLink = await db
        .select({ id: studentModules.id })
        .from(studentModules)
        .where(and(eq(studentModules.studentId, user.id), eq(studentModules.moduleId, matchedModule.id)))
        .limit(1);

      if (existingLink.length === 0) {
        await db.update(studentModules)
          .set({ order: sql`${studentModules.order} + 1` })
          .where(eq(studentModules.studentId, user.id));
        await db.insert(studentModules).values({ studentId: user.id, moduleId: matchedModule.id, order: 1 });
      }

      const existingNodes = await db
        .select()
        .from(nodes)
        .where(eq(nodes.moduleId, matchedModule.id))
        .orderBy(nodes.order);
      return Response.json({
        module: matchedModule,
        nodes: existingNodes,
        cached: true,
      });
    }

    // Shift existing student's modules down and insert new module as #1
    await db.update(studentModules)
      .set({ order: sql`${studentModules.order} + 1` })
      .where(eq(studentModules.studentId, user.id));

    // Generate and save embedding for the new topic
    let topicEmbedding: number[] | null = null;
    try {
      const embeddingResult = await generateEmbedding(topic);
      topicEmbedding = embeddingResult.embedding;
    } catch (err) {
      console.warn("[path] could not generate embedding for new topic:", err);
    }

    const [newModule] = await db
      .insert(modules)
      .values({
        subjectId: subject.id,
        title: moduleTitle,
        order: 0,
        requiredPoints: 0,
        topic: topic,
        generated: true,
        topicEmbedding: topicEmbedding ? JSON.stringify(topicEmbedding) : null,
      })
      .returning();

    // Link student to new module
    await db.insert(studentModules).values({ studentId: user.id, moduleId: newModule.id, order: 1 });

    // Insert nodes
    const nodeValues = aiNodes.map((n: z.infer<typeof nodeSchema>, i: number) => ({
      moduleId: newModule.id,
      title: n.title,
      order: i + 1,
      type: n.type,
      aiPromptContext: n.aiPromptContext,
    }));

    const createdNodes = await db.insert(nodes).values(nodeValues).returning();

    return Response.json({
      module: newModule,
      nodes: createdNodes,
      cached: false,
    });
  } catch (error) {
    console.error("Path generation error:", error);
    return Response.json(
      { error: "Error al generar el camino de aprendizaje. Intenta con otro tema." },
      { status: 500 }
    );
  }
}
