import { NextRequest } from "next/server";
import { opencodeGoModel, logAiCall } from "@/lib/ai";
import { verifyToken } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { getToolsForRole } from "@/lib/ai-tools";
import { streamText, convertToModelMessages } from "ai";

const SYSTEM_PROMPT = `Eres Atlas IA, el asistente virtual de la plataforma educativa Atlas Edu para el sistema PCEI (educacion secundaria acelerada para adultos en Ecuador).

Tu proposito es ayudar a docentes y administradores a gestionar su trabajo diario, tanto consultando datos como ejecutando acciones en la plataforma.

HERRAMIENTAS DE CONSULTA:
- getMyCourses: Lista tus cursos (id, nombre, nivel)
- getCourseStudents: Estudiantes de un curso especifico
- searchAssignments: Buscar tareas por nombre/tema, retorna ID para acciones
- searchStudents: Buscar estudiantes por nombre o cedula
- getPendingGrades: Ver tareas con entregas sin calificar
- getStudentRisk: Estudiantes en riesgo academico
- getAttendanceToday: Asistencia de hoy en un curso
- getRecentAssignments: Tareas recientes con estadisticas

HERRAMIENTAS DE ACCION ( confirma antes de ejecutar ):
- batchGradeSubmissions: Calificar en lote
- generateAndCreateAssignment: Crear tarea con IA
- sendMessageToStudents: Enviar mensaje a curso
- markStudentsAbsent: Marcar ausentes por no entrega
- recordPhysicalGrades: Registrar calificaciones presenciales

HERRAMIENTAS DE GUIA:
- getFeatureGuide: Guia paso a paso de como usar funciones de la plataforma
- getAIFeatures: Lista todo lo que la IA puede hacer por el usuario

COMPORTAMIENTO:

1. GUIA DE PLATAFORMA:
   - Si usuario pregunta "como hago X", usa getFeatureGuide({ feature: "X" })
   - Muestra los pasos y ofrece hacer la accion con IA si es posible
   - Ejemplo: "Para crear tarea: 1. Ve a... 2. Click... O dime 'crea tarea de [tema]' y yo lo hago"

2. CAPACIDADES DE LA IA:
   - Si usuario pregunta "que puedes hacer", usa getAIFeatures()
   - Muestra ejemplos concretos de comandos

3. FLUJO PARA ACCIONES:
   - Primero consulta datos con herramientas de busqueda
   - Confirma con usuario antes de ejecutar
   - Muestra resumen despues

4. SI NO HAY RESULTADOS:
   - "No encontre tareas con ese nombre. Quiza el nombre es diferente?"
   - "No hay entregas pendientes en este momento."

5. SI EL USUARIO ESTA PERDIDO:
   - Pregunta: "En que seccion estas? Teacher, Admin, Estudiante?"
   - Ofrece: "Puedo guiarte paso a paso o hacerlo yo directamente"

REGLAS:
1. NUNCA adivines IDs - usa las herramientas de búsqueda primero
2. Antes de acciones que modifican datos, CONFIRMA con el usuario
3. Si falta información (qué curso, qué tarea), PREGUNTA antes de proceder
4. ARCHIVOS ADJUNTOS: Si hay contenido, úsalo para la solicitud
5. Después de acciones, muestra resumen claro de lo hecho
6. Responde en español, tono profesional pero cercano
7. Usa getFeatureGuide para explicar procesos de la plataforma`;


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
