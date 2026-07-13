/**
 * @swagger
 * /api/practice/diagram:
 *   post:
 *     summary: Generar diagrama educativo
 *     description: Genera un diagrama en sintaxis Mermaid.js para una materia y tema. Actualiza la práctica en caché si se proporciona nodeId.
 *     tags: [Práctica e IA]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subject, topicContext]
 *             properties:
 *               subject:
 *                 type: string
 *                 description: Slug de la materia
 *               topicContext:
 *                 type: string
 *                 description: Contexto del tema
 *               nodeId:
 *                 type: integer
 *                 description: ID del nodo para actualizar en caché
 *     responses:
 *       200:
 *         description: Diagrama generado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mermaid:
 *                   type: string
 *                   description: Código Mermaid.js del diagrama
 *                 caption:
 *                   type: string
 *                   description: Título descriptivo del diagrama
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo estudiantes
 *       500:
 *         description: Error interno
 */
import { NextRequest, NextResponse } from "next/server";
import { getChatModel, getChatModelCandidates, isRetryableModelError, logAiCall, tryParseJson } from "@/lib/ai";
import { isValidMermaid, sanitizeMermaid } from "@/lib/mermaid-validate";
import { db } from "@/lib/db";
import { studentExercises } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { generateObject, generateText } from "ai";
import { z } from "zod/v4";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { getStudyMaterialForStudent } from "@/lib/study-material";

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
- Texto de cada nodo: solo letras, numeros y espacios. SIN parentesis (), corchetes [] ni comillas dentro del texto.
- Si necesitas incluir caracteres especiales, usa comillas dobles: A["texto aqui"]
- Ejemplo correcto: A[Suma de vectores] --> B[Resultante]
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

    const studyMaterial = await getStudyMaterialForStudent(user.id, subject as string);
    if (studyMaterial) {
      console.log(`[diagram-regen] study material found: "${studyMaterial.title}" (${studyMaterial.content.length} chars)`);
    }
    const MAX_MATERIAL_CHARS = 3000;
    const materialContent = studyMaterial
      ? studyMaterial.content.length > MAX_MATERIAL_CHARS
        ? studyMaterial.content.slice(0, MAX_MATERIAL_CHARS) + `\n\n[... contenido truncado de ${studyMaterial.content.length} caracteres. Solo se muestran los primeros ${MAX_MATERIAL_CHARS}.]`
        : studyMaterial.content
      : "";
    const materialBlock = studyMaterial
      ? `\n\nMATERIAL DE ESTUDIO DEL CURSO (basa el diagrama en este contenido):\n${materialContent}`
      : "";

    const candidates = getChatModelCandidates(null);
    const prompt = diagramPrompt(ctx.area, topicContext) + materialBlock;
    const jsonResponsePrompt = diagramJsonPrompt(ctx.area, topicContext) + materialBlock;

    let diagram: z.infer<typeof diagramSchema> | null = null;
    let lastError: unknown;

    for (const candidate of candidates) {
      try {
        const aiModel = getChatModel(candidate);
        const diagramStart = performance.now();
        const isTextOnlyProvider = candidate.provider === "groq" || candidate.provider === "deepseek" || candidate.provider === "opencode";

        if (isTextOnlyProvider) {
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
            const parsed = tryParseJson<Record<string, string>>(r.text);
            let mermaidStr = parsed.mermaid || "";
            mermaidStr = mermaidStr.replace(/^```(?:mermaid)?\s*\n?/i, "").replace(/\n?```\s*$/, "").trim();
            diagram = { mermaid: sanitizeMermaid(mermaidStr), caption: parsed.caption || "" };
          } catch {
            console.error("[diagram-regen] failed to parse JSON from generateText");
            diagram = null;
          }
        } else {
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
            diagram = {
              mermaid: sanitizeMermaid(r.object.mermaid),
              caption: r.object.caption,
            };
          } catch (err) {
            const msg = String(err instanceof Error ? err.message : err ?? "");
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
                const parsed = tryParseJson<Record<string, string>>(r.text);
                let mermaidStr = parsed.mermaid || "";
                mermaidStr = mermaidStr.replace(/^```(?:mermaid)?\s*\n?/i, "").replace(/\n?```\s*$/, "").trim();
                diagram = { mermaid: sanitizeMermaid(mermaidStr), caption: parsed.caption || "" };
              } catch {
                console.error("[diagram-regen] failed to parse JSON from generateText");
                diagram = null;
              }
            } else {
              throw err;
            }
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = studentRecord[0].data as any;
        if (raw.data?.lesson) {
          raw.data.lesson.diagram = diagram;
          await db
            .update(studentExercises)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
