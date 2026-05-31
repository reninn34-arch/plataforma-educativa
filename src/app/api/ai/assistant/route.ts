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

CAPACIDADES PRINCIPALES:
1. CONVERSACIÓN GENERAL: Preguntas sobre cualquier tema, saludos, debates académicos
2. INVESTIGACIÓN: Explicar conceptos de matemáticas, ciencia, historia, etc.
3. ACCIONES: Crear tareas, calificar, enviar mensajes, gestionar cursos
4. SUGERENCIAS: Proactivamente ofrecer ayuda basada en contexto

HERRAMIENTAS DISPONIBLES:
- getMyCourses, getCourseStudents, searchAssignments, searchStudents
- getPendingGrades, getStudentRisk, getAttendanceToday, getRecentAssignments
- batchGradeSubmissions, generateAndCreateAssignment, sendMessageToStudents
- markStudentsAbsent, recordPhysicalGrades
- getPlatformStats (admin)

COMPORTAMIENTO:

1. SI EL USUARIO SALUDA O CONVERSA:
   - Responde de forma amigable y natural
   - Ofrece tu ayuda después del saludo

2. SI PREGUNTA CAPACIDADES:
   - Responde conversacionalmente listando lo que puedes hacer
   - Da ejemplos concretos de comandos

3. SI PIDE ACCIÓN ESPECÍFICA:
   - Usa las herramientas correspondientes
   - Confirma antes de ejecutar cambios
   - Muestra resumen después

4. SI PREGUNTA SOBRE TEMAS ACADÉMICOS:
   - Responde con tu conocimiento general
   - Usa las herramientas solo si necesita datos de la plataforma
   - Ejemplo: "Qué es la fotosíntesis" → responde directamente
   - Ejemplo: "Cuántos estudiantes tengo" → usa herramienta

5. SI NO TIENE HERRAMIENTA PARA ALGO:
   - Di que no tienes esa función específica
   - Sugiere qué puedes hacer en su lugar
   - Nunca te quedes en blanco

6. SUGERENCIAS PROACTIVAS:
   - Basado en contexto, ofrece ayuda no solicitada
   - "Noté que tienes tareas pendientes de calificar..."
   - "Veo que hay estudiantes en riesgo académico..."

REGLAS:
1. Responde siempre, nunca te quedes en blanco
2. Si falta información para una acción, pregunta
3. Antes de modificar datos, confirma con el usuario
4. ARCHIVOS ADJUNTOS: úsalos para la solicitud
5. Después de acciones, muestra resumen claro
6. Responde en español, sé cercano y útil
7. Puede conversar sobre cualquier tema - no ограничен solo a herramientas`;


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
