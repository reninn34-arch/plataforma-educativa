import { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { subjects, modules, nodes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getChatModel, getChatModelCandidates, isRetryableModelError, logAiCall, resolveModel } from "@/lib/ai";
import { generateObject } from "ai";
import { z } from "zod/v4";
import { rateLimit } from "@/lib/rate-limit";
import { pathGenerateSchema } from "@/lib/api-helpers";

const nodeSchema = z.object({
  title: z.string(),
  type: z.enum(["concept", "quiz", "challenge"]),
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

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
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

    for (const candidate of candidates) {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await generateObject({
          model: getChatModel(candidate),
          schema: pathSchema,
          system: systemPrompt,
          prompt: `AREA: ${areaContext}
TEMA SOLICITADO POR EL ESTUDIANTE: "${topic}"

Genera un Learning Path de 6-8 nodos para este tema. Los primeros nodos deben ser de tipo "concept" (ensenanza) y los ultimos de tipo "quiz" o "challenge" (practica).`,
          temperature: 0.8,
          maxOutputTokens: 4000,
          abortSignal: abortController.signal,
        });
        clearTimeout(timeoutId);
        outputParsed = response.object;
        usedModel = candidate;
        break;
      } catch (error) {
        clearTimeout(timeoutId);
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

    // Check for duplicate by topic + subject
    const existingModule = await db
      .select()
      .from(modules)
      .where(eq(modules.topic, topic))
      .limit(1);

    if (existingModule.length > 0 && existingModule[0].subjectId === subject.id) {
      const existingNodes = await db
        .select()
        .from(nodes)
        .where(eq(nodes.moduleId, existingModule[0].id))
        .orderBy(nodes.order);
      return Response.json({
        module: existingModule[0],
        nodes: existingNodes,
        cached: true,
      });
    }

    // Insert module
    const maxOrder = await db
      .select({ max: modules.order })
      .from(modules)
      .where(eq(modules.subjectId, subject.id))
      .then(rows => rows.length > 0 ? rows[0].max : 0);

    const [newModule] = await db
      .insert(modules)
      .values({
        subjectId: subject.id,
        title: moduleTitle,
        order: (maxOrder ?? 0) + 1,
        requiredPoints: 0,
        topic: topic,
        generated: true,
      })
      .returning();

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
