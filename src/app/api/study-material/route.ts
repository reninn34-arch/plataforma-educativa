import { NextRequest } from "next/server";
import { opencodeGoModel } from "@/lib/ai";
import { generateText } from "ai";

const SUBJECT_CONTEXT: Record<string, string> = {
  matematicas: "Matematicas para adultos en bachillerato acelerado (Ecuador). Temas: aritmetica, algebra, geometria, estadistica basica.",
  lenguaje: "Lenguaje y Literatura para adultos. Temas: ortografia, gramatica, comprension lectora, redaccion, tipos de texto.",
  ciencias: "Ciencias Naturales para adultos. Temas: biologia basica, fisica elemental, quimica introductoria, ciencias de la tierra.",
  sociales: "Ciencias Sociales para adultos. Temas: historia del Ecuador, geografia, educacion civica, derechos y democracia.",
};

export async function POST(request: NextRequest) {
  const { subject, topic } = await request.json();
  const ctx = SUBJECT_CONTEXT[subject] || SUBJECT_CONTEXT.matematicas;

  const result = await generateText({
    model: opencodeGoModel,
    system: "Eres un profesor experto en educacion acelerada para adultos (PCEI). Genera contenido educativo claro, con ejemplos practicos y lenguaje sencillo. Usa maximo 250 palabras.",
    prompt: `AREA: ${ctx}${topic ? `\n\nTema especifico: ${topic}.` : ""}\n\nGenera un resumen teorico con:\n- Concepto clave (1 oracion)\n- Explicacion sencilla (2-3 oraciones)\n- 2 ejemplos practicos\n- Dato curioso o aplicacion en la vida real`,
    maxOutputTokens: 400,
    temperature: 0.7,
  });

  return Response.json({ content: result.text });
}
