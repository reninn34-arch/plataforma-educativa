import { NextRequest } from "next/server";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { subjects, modules, nodes, studentModules } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getChatModel, getChatModelCandidates, isRetryableModelError, logAiCall, resolveModel, tryParseJson } from "@/lib/ai";
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
- Cada nodo: "title" corto (max 6 palabras), "type" segun corresponda, "aiPromptContext" detallado (2-3 oraciones).
- Contenido apropiado para adultos que retoman sus estudios, con ejemplos practicos de la vida real.
- Progresion de dificultad: de lo mas basico a lo mas avanzado.
- "moduleTitle": titulo descriptivo del camino completo.`;

    const startTime = performance.now();
    let outputParsed: z.infer<typeof pathSchema> | null = null;
    let usedModel = resolved;
    let lastError: unknown;
    const REQUEST_TIMEOUT_MS = 60_000;
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
            ...(isReasoning ? {} : { system: systemPrompt, temperature: 0.3 }),
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
              ...(isReasoning ? {} : { system: systemPrompt, temperature: 0.3 }),
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
              ...(isReasoning ? {} : { system: systemPrompt, temperature: 0.3 }),
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

        const msg = String((error as any)?.message || error || "");
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
              temperature: 0.3,
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

    const existingModule = subjectModules.find(
      (m) => m.topic && normalizeTopic(m.topic) === normalizedTopic
    );

    if (existingModule) {
      // Link current student to this module if not already linked
      const existingLink = await db
        .select({ id: studentModules.id })
        .from(studentModules)
        .where(and(eq(studentModules.studentId, user.id), eq(studentModules.moduleId, existingModule.id)))
        .limit(1);

      if (existingLink.length === 0) {
        await db.update(studentModules)
          .set({ order: sql`${studentModules.order} + 1` })
          .where(eq(studentModules.studentId, user.id));
        await db.insert(studentModules).values({ studentId: user.id, moduleId: existingModule.id, order: 1 });
      }

      const existingNodes = await db
        .select()
        .from(nodes)
        .where(eq(nodes.moduleId, existingModule.id))
        .orderBy(nodes.order);
      return Response.json({
        module: existingModule,
        nodes: existingNodes,
        cached: true,
      });
    }

    // Shift existing student's modules down and insert new module as #1
    await db.update(studentModules)
      .set({ order: sql`${studentModules.order} + 1` })
      .where(eq(studentModules.studentId, user.id));

    const [newModule] = await db
      .insert(modules)
      .values({
        subjectId: subject.id,
        title: moduleTitle,
        order: 0,
        requiredPoints: 0,
        topic: topic,
        generated: true,
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
