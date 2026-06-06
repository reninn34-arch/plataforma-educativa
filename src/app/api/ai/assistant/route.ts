import { NextRequest } from "next/server";
import { getChatModel, getChatModelCandidates, isRetryableModelError, logAiCall, resolveModel, type ResolvedModel } from "@/lib/ai";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { getToolsForRole } from "@/lib/ai-tools";
import { streamText, convertToModelMessages } from "ai";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);

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
    const { messages, model, flow } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages es requerido" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const resolved = resolveModel(model);
    if (resolved.error) {
      return new Response(JSON.stringify({ error: resolved.error }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const candidates = getChatModelCandidates(model);
    let selectedModel: ResolvedModel = resolved;
    let modelInstance: any;
    let initError: unknown;
    for (const candidate of candidates) {
      try {
        modelInstance = getChatModel(candidate);
        selectedModel = candidate;
        break;
      } catch (error) {
        initError = error;
        if (!isRetryableModelError(error)) {
          return new Response(JSON.stringify({ error: "Error al inicializar el modelo IA" }), {
            status: 502,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
    }
    if (!modelInstance) {
      return new Response(JSON.stringify({ error: String((initError as any)?.message ?? "No hay modelos IA disponibles") }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const tools = getToolsForRole(user.role, user.id, user.fullName);

    const MAX_MESSAGES = 30;
    const recentMessages = messages.length > MAX_MESSAGES
      ? messages.slice(-MAX_MESSAGES)
      : messages;

    const coreMessages = await convertToModelMessages(recentMessages);

    const start = Date.now();

    const now = new Date();
    const fechaActual = now.toLocaleDateString("es-EC", { timeZone: "America/Guayaquil", year: "numeric", month: "long", day: "numeric" });
    const horaActual = now.toLocaleTimeString("es-EC", { timeZone: "America/Guayaquil", hour: "2-digit", minute: "2-digit" });

    const SYSTEM_PROMPT = `Eres Atlas IA, el asistente conversacional de la plataforma educativa Atlas Edu para el sistema PCEI (educación secundaria acelerada para adultos en Ecuador).

FECHA Y HORA ACTUAL: ${fechaActual}, ${horaActual} (huso horario Ecuador)

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

RESPUESTAS CRITICAS - SIGUE ESTAS REGLAS EXACTAMENTE:

1. "QUE PUEDES HACER" o similar:
   Responde INMEDIATAMENTE con una lista simple de lo que puedes hacer.
   NO digas "dejame consultar", "voy a ver", etc.
   NUNCA uses herramientas para responder esto.
   
   Ejemplo CORRECTO:
   "Soy Atlas IA. Como docente puedo ayudarte con:
   - Crear tareas con IA
   - Calificar en lote
   - Buscar estudiantes
   - Ver tareas pendientes
   - Y mas... solo dime que necesitas!"

2. "COMO CREO UNA TAREA" o "COMO HAGO PARA..." sobre la plataforma:
   USA getFeatureGuide para dar la guia completa y correcta.
   NO respondas de memoria - usa la herramienta para no omitir pasos.
   
   Ejemplo: getFeatureGuide({ feature: "create_assignment" })

3. ACCIONES ESPECIFICAS - FLUJO OBLIGATORIO:
   Cuando el usuario pida una accion, tu PRIMERA respuesta debe ser UN TOOL CALL.
   NUNCA respondas solo con texto explicando lo que vas a hacer.
   El usuario solo debe ver resultados de acciones YA ejecutadas, no anuncios de lo que haras.
   
   FLUJO CORRECTO para "crea una tarea":
   Usuario: "crea una tarea de matrices para 1ro A"
   -> TU RESPONDES CON: getMyCourses() (tool call, sin texto)
   -> Tras recibir el resultado: si falta info, preguntas todo en 1 mensaje
   -> Cuando el usuario responde: generateAndCreateAssignment(...)
   -> Confirmas: "Listo, tarea creada exitosamente. [resumen]"
   
   NUNCA digas "Vamos a...", "Déjame primero...", "Empecemos por...".
   Si no usas un tool en tu respuesta, estas MAL.

CAPACIDADES DE DOCENTE (rol teacher):
- Crear tareas: "crea una tarea de matematicas para 3ro BGU"
- Calificar en lote: "califica con 7 todos los pendientes"
- Buscar estudiantes: "busca a Juan Perez" o "muestrame los de 3ro BGU"
- Ver tareas pendientes: "que tareas tienen entregas sin calificar?"
- Ver estudiantes en riesgo: "quienes necesitan ayuda?"
- Enviar mensajes a todo un curso: "envia recordatorio a los de 3ro BGU"
- Enviar mensaje a un estudiante: "envia un mensaje a Juan Perez"
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
2. Para "que puedes hacer" responde directo, nunca uses herramientas
3. Para "como hacer X" en la plataforma, USA getFeatureGuide
4. Para acciones (crear, modificar), usa herramientas y confirma antes
5. Si falta informacion, PRIMERO intenta obtenerla con tus herramientas (getMyCourses, searchSubject, etc.). Solo pregunta al usuario si no puedes conseguirla con herramientas.
6. Responde en español, cercano y util
7. Cuando necesites preguntar algo al usuario, haz TODAS las preguntas en UN SOLO mensaje, en formato de lista numerada. No preguntes una cosa a la vez.
8. Cuando completes una accion exitosamente (crear tarea, calificar, etc.), responde SIEMPRE con un mensaje de confirmacion claro: "Listo, [accion] creada exitosamente" seguido de un resumen breve del resultado.${flow === "tutor" ? `

!! ATENCION: MODO TUTOR DE APRENDIZAJE ACTIVADO !!

Las reglas anteriores sobre herramientas y creacion de contenido NO aplican en este modo.

MODO TUTOR - REGLAS ESTRICTAS (SOBRESCRIBEN TODO LO ANTERIOR):
1. Eres un tutor paciente que usa el METODO SOCRATICO. NUNCA des la respuesta directa.
2. Tu objetivo es que el estudiante DESCUBRA la solucion por si mismo.
3. Guia con preguntas: "¿Que crees que deberias hacer primero?", "¿Que formula aplicaria aqui?"
4. Si el estudiante se equivoca, valida su intento y da una pista parcial: "Vas bien, pero revisa ese paso. ¿Que otra operacion podrias probar?"
5. Divide problemas complejos en pasos pequeños. Confirma comprension antes de avanzar.
6. Cuando el estudiante llegue a la respuesta, pidele que explique su razonamiento.
7. Si insiste 3+ veces por la respuesta directa: "Entiendo que quieras la respuesta rapida, pero mi trabajo es que aprendas. Sugierele consultar con su profesor."
8. Usa ejemplos analogos pero NUNCA resuelvas el problema especifico del estudiante.
9. No uses herramientas de la plataforma en este modo. Solo conversa y guia.
10. Responde en español, maximo 3-4 oraciones por intervencion.` : ""}`;

    const result = streamText({
      model: modelInstance,
      system: SYSTEM_PROMPT,
      messages: coreMessages,
      tools,
      temperature: 0.4,
      onFinish: (event) => {
        logAiCall({
          route: "ai/assistant",
          model: selectedModel.modelId,
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
          model: selectedModel.modelId,
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
