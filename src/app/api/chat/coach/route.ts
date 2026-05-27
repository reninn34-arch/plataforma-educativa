import { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";
import { opencodeGoModel } from "@/lib/ai";
import { generateText } from "ai";

const STATIC_TIPS = [
  "Lee la pregunta con atencion. A veces la clave esta en los detalles.",
  "No te apresures. Tomate un momento para analizar antes de responder.",
  "Intenta recordar el concepto que viste en las tarjetas de ensenianza.",
  "Elimina las opciones que sabes que son incorrectas primero.",
  "Cada error te acerca mas a dominar el tema. Sigue practicando.",
];

const COACH_PROMPT = `Eres un "Coach Just-in-Time" para adultos en bachillerato acelerado (PCEI).
El estudiante acaba de equivocarse en un ejercicio. Tu rol es darle una mini-ayuda motivadora.

REGLAS ESTRICTAS:
1. NUNCA des la respuesta correcta directamente.
2. Da UNA pista logica o estrategia concreta para abordar el problema.
3. Usa lenguaje motivador, sencillo y cercano (max 2 oraciones).
4. NO uses jerga tecnica innecesaria.`;

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

    const result = await Promise.race([
      generateText({
        model: opencodeGoModel,
        system: COACH_PROMPT,
        prompt: `Contexto del tema: ${topic || "Tronco comun"}
Pregunta del ejercicio: ${question}
${contextLine}

Genera una mini-ayuda motivadora para el estudiante:`,
        maxOutputTokens: 120,
        temperature: 0.7,
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);

    const coachMessage = result
      ? result.text
      : STATIC_TIPS[Math.floor(Math.random() * STATIC_TIPS.length)];

    return Response.json({ coachMessage });
  } catch (error) {
    console.error("Coach error:", error);
    return Response.json(
      { coachMessage: STATIC_TIPS[Math.floor(Math.random() * STATIC_TIPS.length)] },
      { status: 200 }
    );
  }
}
