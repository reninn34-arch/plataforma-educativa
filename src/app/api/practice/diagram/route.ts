import { NextRequest, NextResponse } from "next/server";
import { getChatModel, getChatModelCandidates, isRetryableModelError, logAiCall, resolveModel, tryParseJson } from "@/lib/ai";
import { isValidMermaid } from "@/lib/mermaid-validate";
import { db } from "@/lib/db";
import { studentExercises } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { generateObject, generateText } from "ai";
import { z } from "zod/v4";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

const diagramSchema = z.object({
  mermaid: z.string(),
  caption: z.string(),
});

const SUBJECT_CONTEXTS: Record<string, { area: string }> = {
  matematicas: { area: "Matematicas - Bachillerato Acelerado para Adultos" },
  fisica: { area: "Fisica - Bachillerato Acelerado para Adultos" },
  ingles: { area: "Ingles - Bachillerato Acelerado para Adultos" },
  quimica: { area: "Quimica - Bachillerato Acelerado para Adultos" },
};

const diagramPrompt = (area: string, topic: string) => `Genera un diagrama educativo visual en sintaxis Mermaid.js sobre el tema.

AREA: ${area}
Tema: ${topic}

REGLAS:
- Usa graph TD con nodos A, B, C, D conectados con flechas --> .
- Texto de cada nodo: claro y descriptivo, en espanol.
- Ejemplo: A[Suma] --> B[Resta]
- caption: maximo 6 palabras descriptivas.`;

const diagramJsonPrompt = (area: string, topic: string) => diagramPrompt(area, topic) + "\n\nResponde SOLO con un JSON valido. Campos: \"mermaid\" (string) y \"caption\" (string).";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "student") return NextResponse.json({ error: "Solo estudiantes" }, { status: 403 });

  try {
    const body = await request.json();
    const { subject, topicContext, nodeId } = body;
    if (!subject || !topicContext) {
      return NextResponse.json({ error: "subject y topicContext requeridos" }, { status: 400 });
    }

    const ctx = SUBJECT_CONTEXTS[subject as string];
    if (!ctx) {
      return NextResponse.json({ error: "Materia no soportada" }, { status: 400 });
    }

    const rl = rateLimit({ key: `diagram:${user.id}`, maxRequests: 10, windowMs: 60_000 });
    if (rl) return rl;

    const candidates = getChatModelCandidates(null);
    const prompt = diagramPrompt(ctx.area, topicContext);
    const jsonResponsePrompt = diagramJsonPrompt(ctx.area, topicContext);

    let diagram: z.infer<typeof diagramSchema> | null = null;
    let lastError: unknown;

    for (const candidate of candidates) {
      try {
        const aiModel = getChatModel(candidate);
        const diagramStart = performance.now();

        try {
          const r = await generateObject({
            model: aiModel,
            schema: diagramSchema,
            prompt,
            temperature: 0.3,
            maxOutputTokens: 1500,
          });
          logAiCall({
            route: "practice-diagram-regen",
            model: candidate.modelId,
            durationMs: Math.round(performance.now() - diagramStart),
            usage: r.usage ? {
              inputTokens: r.usage.inputTokens,
              outputTokens: r.usage.outputTokens,
              totalTokens: (r.usage.inputTokens ?? 0) + (r.usage.outputTokens ?? 0),
            } : undefined,
          });
          diagram = r.object;
        } catch (err) {
          const msg = String((err as any)?.message ?? err ?? "");
          if (msg.includes("response_format") || msg.includes("unavailable")) {
            console.log("[diagram-regen] response_format not supported, falling back to generateText");
            const r = await generateText({
              model: aiModel,
              prompt: jsonResponsePrompt,
              temperature: 0.3,
              maxOutputTokens: 1500,
            });
            logAiCall({
              route: "practice-diagram-regen-text",
              model: candidate.modelId,
              durationMs: Math.round(performance.now() - diagramStart),
              usage: r.usage ? {
                inputTokens: r.usage.inputTokens,
                outputTokens: r.usage.outputTokens,
                totalTokens: (r.usage.inputTokens ?? 0) + (r.usage.outputTokens ?? 0),
              } : undefined,
            });
            try {
              const parsed = tryParseJson(r.text);
              diagram = { mermaid: parsed.mermaid || "", caption: parsed.caption || "" };
            } catch {
              console.error("[diagram-regen] failed to parse JSON from generateText");
              diagram = null;
            }
          } else {
            throw err;
          }
        }

        if (diagram) break;
      } catch (error) {
        lastError = error;
        if (!isRetryableModelError(error)) {
          console.error("[diagram-regen] non-retryable error:", error);
          break;
        }
      }
    }

    if (!diagram) {
      throw (lastError ?? new Error("No se pudo generar diagrama con los modelos configurados"));
    }

    if (!diagram || !isValidMermaid(diagram.mermaid)) {
      throw new Error("Diagrama invalido: no paso validacion de sintaxis");
    }

    // Update cached exercises in DB with new diagram
    if (nodeId) {
      const studentRecord = await db
        .select({ data: studentExercises.data, id: studentExercises.id })
        .from(studentExercises)
        .where(and(eq(studentExercises.studentId, user.id), eq(studentExercises.nodeId, nodeId)))
        .limit(1);

      if (studentRecord.length > 0 && studentRecord[0].data) {
        const raw = studentRecord[0].data as any;
        if (raw.data?.lesson) {
          raw.data.lesson.diagram = diagram;
          await db
            .update(studentExercises)
            .set({ data: raw as any, updatedAt: new Date() })
            .where(eq(studentExercises.id, studentRecord[0].id));
        }
      }
    }

    return NextResponse.json(diagram);
  } catch (error) {
    console.error("Generate diagram error:", error);
    return NextResponse.json(
      { error: "Error al generar diagrama. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
