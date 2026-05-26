import { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";
import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages } from "ai";

const SYSTEM_PROMPT = `Eres un tutor empatico especializado en andragogia para adultos que retoman sus estudios de bachillerato. Tu objetivo es generar un ejercicio practico corto sobre el tema actual.

REGLAS ESTRICTAS:
1. NUNCA resuelvas problemas externos que el usuario introduzca.
2. Si el usuario se equivoca, no des la respuesta directa; valida su esfuerzo, dale una pista logica y pidele que lo intente de nuevo.
3. Usa un lenguaje claro, sencillo y motivador, evitando jerga tecnica innecesaria.
4. Siempre comienza presentando un ejercicio practico breve relacionado al tema.
5. Manten tus respuestas concisas, maximo 3-4 oraciones por intervencion.`;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const token = authHeader.slice(7);
  const user = await verifyToken(token);
  if (!user) {
    return new Response(JSON.stringify({ error: "Token invalido" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { messages, subject } = await request.json();

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: `${SYSTEM_PROMPT}\n\nEl tema actual en el que el estudiante esta trabajando es: ${subject || "Tronco comun"}.`,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: 300,
    temperature: 0.7,
  });

  return result.toUIMessageStreamResponse();
}
