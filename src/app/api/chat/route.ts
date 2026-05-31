import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { chatSessions, chatMessages, subjects } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { getChatModel, getChatModelCandidates, isRetryableModelError, logAiCall, resolveModel, type ResolvedModel } from "@/lib/ai";
import { streamText, convertToModelMessages } from "ai";
import { rateLimit } from "@/lib/rate-limit";
import { chatSchema } from "@/lib/api-helpers";

const SYSTEM_PROMPT = `Eres un tutor empatico especializado en andragogia para adultos que retoman sus estudios de bachillerato. Tu objetivo es generar un ejercicio practico corto sobre el tema actual.

REGLAS ESTRICTAS:
1. NUNCA resuelvas problemas externos que el usuario introduzca.
2. Si el usuario se equivoca, no des la respuesta directa; valida su esfuerzo, dale una pista logica y pidele que lo intente de nuevo.
3. Usa un lenguaje claro, sencillo y motivador, evitando jerga tecnica innecesaria.
4. Siempre comienza presentando un ejercicio practico breve relacionado al tema.
5. Manten tus respuestas concisas, maximo 3-4 oraciones por intervencion.`;

async function getOrCreateSession(userId: number, subjectSlug: string) {
  const [subject] = await db
    .select({ id: subjects.id })
    .from(subjects)
    .where(eq(subjects.slug, subjectSlug))
    .limit(1);

  if (!subject) return null;

  const subjectId = subject.id;

  const [existing] = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.userId, userId), eq(chatSessions.subjectId, subjectId)))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(chatSessions)
    .values({ userId, subjectId })
    .returning();
  return created;
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("atlas-edu-token")?.value;
    const user = token ? await verifyToken(token) : null;
    if (!user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const rl = rateLimit({ key: `chat:${user.id}`, maxRequests: 30, windowMs: 60_000 });
    if (rl) return rl;

    const parsed = chatSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "messages y subject son requeridos" }, { status: 400 });
    }
    const { messages, subject, model } = parsed.data;

    const resolved = resolveModel(model);
    if (resolved.error) {
      return Response.json({ error: resolved.error }, { status: 400 });
    }
    const candidates = getChatModelCandidates(model);
    let selectedModel: ResolvedModel = resolved;
    let modelInstance: any;
    let initError: unknown;
    for (const candidate of candidates) {
      try {
        modelInstance = getChatModel(candidate);
        selectedModel = candidate;
        break;
      } catch (error) {
        initError = error;
        if (!isRetryableModelError(error)) {
          return Response.json({ error: "Error al inicializar el modelo IA" }, { status: 502 });
        }
      }
    }
    if (!modelInstance) {
      return Response.json({ error: String((initError as any)?.message ?? "No hay modelos IA disponibles") }, { status: 502 });
    }

    const startTime = performance.now();
    const result = streamText({
      model: modelInstance,
      system: `${SYSTEM_PROMPT}\n\nEl tema actual en el que el estudiante esta trabajando es: ${subject || "Tronco comun"}.`,
      messages: await convertToModelMessages(messages),
      maxOutputTokens: 300,
      temperature: 0.7,
    });

    result.usage.then((usage) => {
      try {
        logAiCall({
          route: "chat",
          model: selectedModel.modelId,
          durationMs: Math.round(performance.now() - startTime),
          usage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, totalTokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0) },
        });
      } catch {}
    });

    result.text.then(async (fullText) => {
      try {
        const session = await getOrCreateSession(user.id, subject);
        if (!session) return;
        const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
        if (lastUserMsg) {
          await db.insert(chatMessages).values({ sessionId: session.id, role: "user", content: typeof lastUserMsg.parts?.[0]?.text === "string" ? lastUserMsg.parts[0].text : "" });
        }
        await db.insert(chatMessages).values({ sessionId: session.id, role: "assistant", content: fullText });
      } catch {}
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Chat error:", error);
    return Response.json({ error: "Error al procesar el chat" }, { status: 500 });
  }
}
