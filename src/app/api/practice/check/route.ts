import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getChatModel, getChatModelCandidates, isRetryableModelError, resolveModel, repairJson, tryParseJson } from "@/lib/ai";
import { generateText, Output } from "ai";
import { practiceCheckSchema } from "@/lib/api-helpers";
import { z } from "zod/v4";

const semanticCheckResponseSchema = z.object({
  isCorrect: z.boolean(),
});

function isResponseFormatError(error: unknown): boolean {
  const msg = String((error as any)?.message ?? "").toLowerCase();
  return msg.includes("response_format") || msg.includes("unavailable");
}

const SEMANTIC_CHECK_PROMPT = `Eres un evaluador de respuestas para ejercicios de completar espacios (fill in the blank) en bachillerato acelerado para adultos (PCEI). Tu unica tarea es determinar si la respuesta del estudiante es SEMANTICAMENTE EQUIVALENTE a alguna de las respuestas aceptadas.

REGLAS:
- "isCorrect": true SOLO si la respuesta significa lo mismo que al menos una respuesta aceptada (sinonimos, mayusculas/minusculas, variaciones gramaticales menores).
- "isCorrect": false si la respuesta es semantica o conceptualmente incorrecta.
- No seas demasiado laxo. Errores conceptuales = false.`;

function isDeterministicMatch(studentAnswer: string, accepted: string[]): boolean {
  return accepted.some((a: string) =>
    String(a).toLowerCase().trim() === String(studentAnswer).toLowerCase().trim()
  );
}

async function aiSemanticCheck(
  question: string,
  studentAnswer: string,
  acceptedAnswers: string[],
  requestedModel?: unknown
): Promise<boolean | null> {
  const candidates = getChatModelCandidates(requestedModel);
  for (const candidate of candidates) {
    try {
      const model = getChatModel(candidate);
      const prompt = `Pregunta: ${question}

Respuesta del estudiante: "${studentAnswer}"

Respuestas aceptadas: ${JSON.stringify(acceptedAnswers)}

Evalua si la respuesta del estudiante es semanticamente equivalente a alguna de las aceptadas.`;

      let result: { isCorrect: boolean } | null = null;

      try {
        // Tier 1: Output.object({ schema }) (Kimi, OpenAI, Google, Anthropic)
        const response = await generateText({
          model,
          output: Output.object({ schema: semanticCheckResponseSchema as any }),
          system: SEMANTIC_CHECK_PROMPT,
          prompt,
          maxOutputTokens: 30,
          temperature: 0,
        });
        result = response.output as { isCorrect: boolean };
      } catch (error) {
        // Tier 2: response_format unsupported → Output.json() (DeepSeek)
        if (isResponseFormatError(error)) {
          try {
            const response = await generateText({
              model,
              output: Output.json(),
              system: SEMANTIC_CHECK_PROMPT,
              prompt,
              maxOutputTokens: 30,
              temperature: 0,
            });
            result = semanticCheckResponseSchema.parse(response.output);
          } catch (jsonError) {
            // Tier 3: plain text + tryParseJson as last resort
            if (isResponseFormatError(jsonError) || jsonError instanceof z.ZodError) {
              const response = await generateText({
                model,
                system: SEMANTIC_CHECK_PROMPT,
                prompt,
                maxOutputTokens: 30,
                temperature: 0,
              });
              result = semanticCheckResponseSchema.parse(tryParseJson(response.text));
            } else {
              throw jsonError;
            }
          }
        } else {
          throw error;
        }
      }

      if (!result) continue;

      // Race with timeout
      const timed = await Promise.race([
        Promise.resolve(result),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
      ]);

      if (timed) return timed.isCorrect;
    } catch (error) {
      if (!isRetryableModelError(error)) return null;
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user || user.role !== "student") return NextResponse.json({ error: "Solo estudiantes" }, { status: 403 });

  try {
    const parsed = practiceCheckSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Datos invalidos" }, { status: 400 });
    }
    const { question, type, studentAnswer, correctAnswer, model } = parsed.data;

    const resolved = resolveModel(model);
    if (resolved.error) {
      return Response.json({ error: resolved.error }, { status: 400 });
    }

    let isCorrect = false;

    if (type === "mcq") {
      isCorrect = Number(studentAnswer) === Number(correctAnswer);
    } else if (type === "true_false") {
      const studentBool = studentAnswer === true || studentAnswer === "true";
      const correctBool = correctAnswer === true || correctAnswer === "true";
      isCorrect = studentBool === correctBool;
    } else if (type === "fill_blank") {
      const accepted: string[] = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer].filter(Boolean);

      if (isDeterministicMatch(String(studentAnswer), accepted)) {
        isCorrect = true;
      } else {
        const aiResult = await aiSemanticCheck(question, String(studentAnswer), accepted, model);
        if (aiResult !== null) {
          isCorrect = aiResult;
        }
      }
    }

    const feedback = isCorrect
      ? "Correcto! Bien hecho, sigue asi."
      : "Incorrecto. Revisa la pregunta e intentalo de nuevo en la siguiente ronda.";

    return Response.json({ isCorrect, feedback });
  } catch (error) {
    console.error("Check answer error:", error);
    return Response.json(
      { error: "Error al evaluar la respuesta." },
      { status: 500 }
    );
  }
}
