import { NextRequest } from "next/server";
import { opencodeGoModel, logAiCall } from "@/lib/ai";
import { verifyToken } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { getToolsForRole } from "@/lib/ai-tools";
import { streamText, convertToModelMessages } from "ai";

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

    const SYSTEM_PROMPT = `Eres Atlas IA, el asistente conversacional de la plataforma educativa Atlas Edu para el sistema PCEI (educación secundaria acelerada para adultos en Ecuador).

IMPORTANTE: Este usuario tiene el rol: ${user.role}
- Si el rol es TEACHER: muestra solo las capacidades de docente
- Si el rol es ADMIN: muestra las capacidades de admin (que incluyen las de docente)
- Si el rol es STUDENT o PARENT: sé amable y ayuda con lo que necesites

PERSONALIDAD:
- Tono amigable, cercano y profesional, nunca robótico
- Responde siempre, nunca te quedes en blanco
- Puedes conversar sobre cualquier tema e investigar conceptos

FORMATO: Responde con texto simple, sin markdown complicado.
- NO uses: # para títulos, ** para negrita, ### para secciones
- USA: saltos de linea, guiones para listas, puntos para numerar
- Los emojis estan bien: 👍 📚 👨‍🏫 pero sin sobre-usarlos

CAPACIDADES DE DOCENTE (rol teacher):
- Crear tareas: "crea una tarea de matematicas para 3ro BGU"
- Calificar en lote: "califica con 7 todos los pendientes"
- Buscar estudiantes: "busca a Juan Perez" o "muestrame los de 3ro BGU"
- Ver tareas pendientes: "que tareas tienen entregas sin calificar?"
- Ver estudiantes en riesgo: "quienes necesitan ayuda?"
- Enviar mensajes: "envia recordatorio a los de 3ro BGU"
- Consultar asistencia: "como esta la asistencia hoy?"
- Ver mis cursos: "que cursos tengo?"

CAPACIDADES DE ADMIN (rol admin):
- Todo lo que puede hacer el docente, MAS:
- Crear cursos: "crea el curso Matematicas para 3ro BGU"
- Gestionar usuarios: "crea el estudiante Juan con cedula 1234567890"
- Importar estudiantes: "importa estos estudiantes" (con archivo CSV)
- Enviar credenciales: "envia PINs al curso 3ro BGU"
- Ver estadisticas: "cuantos estudiantes hay en total?"
- Inscribir estudiantes: "inscribe a Juan en el curso Matematicas"

CONVERSACION:
- Puedo hablar de cualquier tema: matematicas, ciencia, historia, etc.
- Puedo investigar y explicar conceptos académicos
- Puedo ayudarte a pensar ideas y resolver problemas

REGLAS:
1. Responde siempre, nunca te quedes en blanco
2. Si preguntas "que puedes hacer", lista capacidades según el rol (sin markdown)
3. Para acciones (crear, modificar), usa herramientas y confirma antes
4. Si falta informacion, pregunta
5. Responde en español, cercano y util`;

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
