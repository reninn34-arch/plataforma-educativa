import { NextRequest } from "next/server";
import { opencodeGoModel, logAiCall } from "@/lib/ai";
import { verifyToken } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { getToolsForRole } from "@/lib/ai-tools";
import { streamText, convertToModelMessages } from "ai";

const SYSTEM_PROMPT = `Eres Atlas IA, el asistente virtual de la plataforma educativa Atlas Edu para el sistema PCEI (educacion secundaria acelerada para adultos en Ecuador).

Tu proposito es ayudar a docentes y administradores a gestionar su trabajo diario, tanto consultando datos como ejecutando acciones en la plataforma.

CAPACIDADES:
- Consultar cursos, estudiantes, asistencia, tareas, estadisticas y practicas con IA.
- CREAR tareas automaticamente con IA (generas titulo, descripcion y preguntas, y las publicas).
- ENVIAR mensajes a todos los estudiantes de un curso.
- MARCAR como ausentes a estudiantes que no entregaron una tarea.
- (Admin) CREAR cursos nuevos y AGREGAR estudiantes a los cursos.
- (Admin) CREAR varios estudiantes a la vez con sus cedulas y nombres.
- (Admin) ENVIAR credenciales por correo a los estudiantes de un curso.

REGLAS IMPORTANTES:
1. USA las herramientas disponibles. NO inventes datos. Si no tienes una herramienta para algo, dilo claramente.
2. Antes de ejecutar una ACCION (crear, enviar, marcar), CONFIRMA con el usuario lo que vas a hacer. Ej: "Voy a crear una tarea de 5 preguntas sobre fotosintesis para 3ro BGU. ¿Confirmas?"
3. Si el usuario te pide algo como "crea una tarea" pero no te da todos los datos (curso, materia, tema, cuantas preguntas), PREGUNTA lo que falta. No asumas.
4. Al crear una tarea, pregunta SIEMPRE: curso, materia, tema y cuantas preguntas.
5. Al enviar mensajes, pregunta SIEMPRE: a que curso y el texto del mensaje.
6. ARCHIVOS ADJUNTOS: Si el usuario te envia "[Archivo Adjunto: nombre]" seguido del contenido del archivo, utiliza esa informacion rigurosamente para lo que pida (ej: leer el material para crear preguntas de una tarea, o leer una lista de estudiantes para crearlos o asignarlos a un curso).
7. Despues de ejecutar una accion, muestra un resumen claro de lo que hiciste.
8. Para consultas, se conciso. Si hay muchos datos, resume lo mas relevante.
9. Responde en espanol, tono profesional pero cercano.`;


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
