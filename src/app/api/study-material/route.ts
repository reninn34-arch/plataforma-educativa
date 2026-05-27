import { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";
import { opencodeGoModel, logAiCall } from "@/lib/ai";
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
    const user = token ? await verifyToken(token) : null;
    if (!user) {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }

    const rl = rateLimit({ key: `study-material:${user.id}`, maxRequests: 10, windowMs: 60_000 });
    if (rl) return rl;

    const parsed = studyMaterialSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Materia requerida" }, { status: 400 });
    }
    const { subject, topic } = parsed.data;
    const ctx = SUBJECT_CONTEXT[subject] || SUBJECT_CONTEXT.matematicas;

    const startTime = performance.now();
    const result = await generateText({
      model: opencodeGoModel,
      system: "Eres un profesor experto en educacion acelerada para adultos (PCEI). Genera contenido educativo claro, con ejemplos practicos y lenguaje sencillo. Usa maximo 250 palabras.",
      prompt: `AREA: ${ctx}${topic ? `\n\nTema especifico: ${topic}.` : ""}\n\nGenera un resumen teorico con:\n- Concepto clave (1 oracion)\n- Explicacion sencilla (2-3 oraciones)\n- 2 ejemplos practicos\n- Dato curioso o aplicacion en la vida real`,
      maxOutputTokens: 400,
      temperature: 0.7,
    });

    logAiCall({
      route: "study-material",
      model: "kimi-k2.5",
      durationMs: Math.round(performance.now() - startTime),
      usage: { inputTokens: result.usage?.inputTokens, outputTokens: result.usage?.outputTokens, totalTokens: (result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0) },
    });

    return Response.json({ content: result.text });
  } catch (error) {
    console.error("Study material error:", error);
    return Response.json({ error: "Error al generar material de estudio" }, { status: 500 });
  }
}
