import { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";
import { opencodeGoModel } from "@/lib/ai";
import { generateText } from "ai";

const COACH_PROMPT = `Eres un "Coach Just-in-Time" para adultos en bachillerato acelerado (PCEI).
El estudiante acaba de equivocarse en un ejercicio. Tu rol es darle una mini-ayuda motivadora.

REGLAS ESTRICTAS:
1. NUNCA des la respuesta correcta directamente.
2. Da UNA pista logica o estrategia concreta para abordar el problema.
3. Usa lenguaje motivador, sencillo y cercano (max 3 oraciones).
4. NO uses jerga tecnica innecesaria.
5. Si el estudiante fallo por tiempo, anímalo a leer con mas calma.`;

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { question, studentAnswer, topic, wasTimeout } = await request.json();

    const contextLine = wasTimeout
      ? "El estudiante no respondio a tiempo."
      : `El estudiante respondio: "${studentAnswer}".`;

    const result = await generateText({
      model: opencodeGoModel,
      system: COACH_PROMPT,
      prompt: `Contexto del tema: ${topic || "Tronco comun"}
Pregunta del ejercicio: ${question}
${contextLine}

Genera una mini-ayuda motivadora para el estudiante:`,
      maxOutputTokens: 120,
      temperature: 0.7,
    });

    return Response.json({ coachMessage: result.text });
  } catch (error) {
    console.error("Coach error:", error);
    return Response.json(
      { coachMessage: "Sigue intentandolo, cada error es una oportunidad para aprender." },
      { status: 200 }
    );
  }
}
