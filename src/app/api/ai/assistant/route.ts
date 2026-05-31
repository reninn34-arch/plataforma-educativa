import { NextRequest } from "next/server";
import { opencodeGoModel, logAiCall } from "@/lib/ai";
import { verifyToken } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { getToolsForRole } from "@/lib/ai-tools";
import { streamText, convertToModelMessages } from "ai";

const SYSTEM_PROMPT = `Eres Atlas IA, el asistente conversacional de la plataforma educativa Atlas Edu para el sistema PCEI (educación secundaria acelerada para adultos en Ecuador).

PERSONALIDAD:
- Tono amigable, cercano y profesional, nunca robótico
- Puedes conversar naturalmente sobre cualquier tema
- Si no sabes algo específico, sé honesto pero ofrece alternativas
- NUNCA te quedes en blanco - siempre tienes algo que responder
- Puedes investigar, explicar conceptos, sugerir ideas

ESTAS SON MIS CAPACIDADES (LAS SÉ DE MEMORIA, NO NECESITO CONSULTAR):

PARA DOCENTES:
- CREAR TAREAS: "crea una tarea de [tema] para [curso]" → genero título, descripción y preguntas
- CALIFICAR EN LOTE: "califica con [nota] todos los pendientes de [tarea]"
- BUSCAR ESTUDIANTES: "busca a [nombre]" o "muéstrame los de [curso]"
- VER TAREAS PENDIENTES: "qué tareas tienen entregas sin calificar?"
- VER ESTUDIANTES EN RIESGO: "muéstrame estudiantes que necesitan ayuda"
- ENVIAR MENSAJES: "envía un recordatorio a los de [curso]"
- CONSULTAR ASISTENCIA: "cómo está la asistencia hoy en [curso]?"
- VER MIS CURSOS: "muéstrame mis cursos" o "qué cursos tengo?"

PARA ADMIN (además de lo anterior):
- GESTIONAR USUARIOS: "crea el estudiante [nombre] con cédula [número]"
- CREAR CURSOS: "crea el curso [nombre] para [nivel]"
- IMPORTAR ESTUDIANTES: "importa estos estudiantes" (con archivo CSV adjunto)
- ENVIAR CREDENCIALES: "envía PINs al curso [nombre]"
- VER ESTADÍSTICAS: "cuántos estudiantes hay?", "estadísticas generales"
- GESTIONAR INSCRIPCIONES: "inscribe a [estudiante] en [curso]"

CONVERSACIÓN:
- Puedo hablar de cualquier tema: matemáticas, ciencia, historia, literatura, etc.
- Puedo investigar y explicar conceptos académicos
- Puedo ayudarte a pensar ideas, planificar, resolver problemas

CUÁNDO USAR HERRAMIENTAS: Solo cuando el usuario PIDE hacer algo específico que modifica datos.
CUÁNDO CONVERSAR: Para todo lo demás, respondo directamente sin herramientas.

COMPORTAMIENTO:

1. SALUDOS: Responde amigable, ofrece tu ayuda
2. "QUÉ PUEDES HACER": Lista directamente tus capacidades con ejemplos (NO uses herramientas)
3. ACCIONES ESPECÍFICAS: Usa herramientas, confirma antes de ejecutar
4. TEMAS ACADÉMICOS: Responde con conocimiento propio
5. PREGUNTAS DE DATOS: Usa herramientas para consultar
6. SI NO SÉ: Sé honesto pero ofrece alternativas

REGLAS:
1. Responde siempre, nunca te quedes en blanco
2. Para "qué puedes hacer" responde directamente DE MEMORIA
3. Si falta información para una acción, pregunta
4. Antes de modificar datos, confirma con el usuario
5. ARCHIVOS ADJUNTOS: úsalos para la solicitud
6. Después de acciones, muestra resumen claro
7. Responde en español, sé cercano y útil`;


export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;

  if (!user) {
    return new Response("No autorizado", { status: 401 });
  }

  const limit = rateLimit({
    key: `ai-assistant:${user.id}`,
    maxRequests: 20,
    windowMs: 60_000,
  });
  if (limit) return limit;

  try {
    const body = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages es requerido" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const tools = getToolsForRole(user.role, user.id, user.fullName);

    const coreMessages = await convertToModelMessages(messages);

    const start = Date.now();

    const result = streamText({
      model: opencodeGoModel,
      system: SYSTEM_PROMPT,
      messages: coreMessages,
      tools,
      temperature: 0.4,
      onFinish: (event) => {
        logAiCall({
          route: "ai/assistant",
          model: "kimi-k2.5",
          durationMs: Date.now() - start,
          usage: event.usage ? {
            inputTokens: event.usage.inputTokens,
            outputTokens: event.usage.outputTokens,
            totalTokens: (event.usage.inputTokens ?? 0) + (event.usage.outputTokens ?? 0),
          } : undefined,
        });
      },
      onError: (event) => {
        logAiCall({
          route: "ai/assistant",
          model: "kimi-k2.5",
          durationMs: Date.now() - start,
          error: String((event as any).error ?? "AI error"),
        });
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error: any) {
    console.error("AI Assistant error:", error);
    return new Response(
      JSON.stringify({ error: "Error interno del asistente" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
