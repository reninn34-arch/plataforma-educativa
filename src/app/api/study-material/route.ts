import { NextRequest } from "next/server";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { getChatModel, getChatModelCandidates, isRetryableModelError, logAiCall, resolveModel } from "@/lib/ai";
import { generateText } from "ai";
import { rateLimit } from "@/lib/rate-limit";
import { studyMaterialSchema } from "@/lib/api-helpers";

const SUBJECT_CONTEXT: Record<string, string> = {
  matematicas: "Matematicas para adultos en bachillerato acelerado (Ecuador). Temas: aritmetica, algebra, geometria, estadistica basica.",
  lenguaje: "Lenguaje y Literatura para adultos. Temas: ortografia, gramatica, comprension lectora, redaccion, tipos de texto.",
  ciencias: "Ciencias Naturales para adultos. Temas: biologia basica, fisica elemental, quimica introductoria, ciencias de la tierra.",
  sociales: "Ciencias Sociales para adultos. Temas: historia del Ecuador, geografia, educacion civica, derechos y democracia.",
};

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("atlas-edu-token")?.value;
    const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
    if (!user || user.role !== "student") {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }

    const rl = rateLimit({ key: `study-material:${user.id}`, maxRequests: 10, windowMs: 60_000 });
    if (rl) return rl;

    const parsed = studyMaterialSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Materia requerida" }, { status: 400 });
    }
    const { subject, topic, model } = parsed.data;
    const resolved = resolveModel(model);
    if (resolved.error) {
      return Response.json({ error: resolved.error }, { status: 400 });
    }
    const candidates = getChatModelCandidates(model);
    const ctx = SUBJECT_CONTEXT[subject] || SUBJECT_CONTEXT.matematicas;

    const startTime = performance.now();
    let result: Awaited<ReturnType<typeof generateText>> | null = null;
    let usedModel = resolved;
    let lastError: unknown;
    const REQUEST_TIMEOUT_MS = 60_000;

    for (const candidate of candidates) {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

      try {
        result = await generateText({
          model: getChatModel(candidate),
          system: "Eres un profesor experto en educación acelerada para adultos (PCEI). Genera contenido educativo claro, con ejemplos prácticos y lenguaje sencillo. Usa máximo 250 palabras.",
          prompt: `AREA: ${ctx}${topic ? `\n\nTema específico: ${topic}.` : ""}\n\nGenera un resumen teórico con:\n- Concepto clave (1 oración)\n- Explicación sencilla (2-3 oraciones)\n- 2 ejemplos prácticos\n- Dato curioso o aplicación en la vida real`,
          maxOutputTokens: 400,
          temperature: 0.7,
          abortSignal: abortController.signal,
        });
        clearTimeout(timeoutId);
        usedModel = candidate;
        break;
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error;
        if (!isRetryableModelError(error)) throw error;
      }
    }

    if (!result) throw (lastError ?? new Error("No se pudo generar material con los modelos configurados"));

    logAiCall({
      route: "study-material",
      model: usedModel.modelId,
      durationMs: Math.round(performance.now() - startTime),
      usage: { inputTokens: result.usage?.inputTokens, outputTokens: result.usage?.outputTokens, totalTokens: (result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0) },
    });

    return Response.json({ content: result.text });
  } catch (error) {
    console.error("Study material error:", error);
    return Response.json({ error: "Error al generar material de estudio" }, { status: 500 });
  }
}
