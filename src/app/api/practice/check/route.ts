/**
 * @swagger
 * /api/practice/check:
 *   post:
 *     summary: Verificar respuesta de ejercicio
 *     description: Evalúa si la respuesta del estudiante es correcta. Usa coincidencia exacta para MCQ/true-false y verificación semántica con IA para fill_blank.
 *     tags: [Práctica e IA]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [question, type, studentAnswer, correctAnswer]
 *             properties:
 *               question:
 *                 type: string
 *                 description: Enunciado de la pregunta
 *               type:
 *                 type: string
 *                 enum: [mcq, fill_blank, true_false]
 *                 description: Tipo de ejercicio
 *               studentAnswer:
 *                 oneOf:
 *                   - type: string
 *                   - type: integer
 *                   - type: boolean
 *                 description: Respuesta del estudiante
 *               correctAnswer:
 *                 oneOf:
 *                   - type: integer
 *                   - type: boolean
 *                   - type: array
 *                     items:
 *                       type: string
 *                 description: Respuesta correcta
 *               model:
 *                 type: string
 *                 description: Modelo de IA para verificación semántica
 *     responses:
 *       200:
 *         description: Resultado de la verificación
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isCorrect:
 *                   type: boolean
 *                 feedback:
 *                   type: string
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo estudiantes
 *       500:
 *         description: Error interno
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { getChatModel, getChatModelCandidates, isRetryableModelError, resolveModel, tryParseJson } from "@/lib/ai";
import { generateObject, generateText } from "ai";
import { practiceCheckSchema } from "@/lib/api-helpers";

import { z } from "zod/v4";

const semanticCheckResponseSchema = z.object({
  isCorrect: z.boolean(),
});

const SEMANTIC_CHECK_PROMPT = `Eres un evaluador de respuestas para ejercicios de completar espacios (fill in the blank) en bachillerato acelerado para adultos (PCEI). Tu unica tarea es determinar si la respuesta del estudiante es SEMANTICAMENTE EQUIVALENTE a alguna de las respuestas aceptadas.

REGLAS:
- "isCorrect": true SOLO si la respuesta significa lo mismo que al menos una respuesta aceptada (sinonimos, mayusculas/minusculas, variaciones gramaticales menores).
- "isCorrect": false si la respuesta es semantica o conceptualmente incorrecta.
- No seas demasiado laxo. Errores conceptuales = false.`;

function isDeterministicMatch(studentAnswer: string, accepted: string[]): boolean {
  // Exact string match first
  if (accepted.some((a: string) => String(a).toLowerCase().trim() === String(studentAnswer).toLowerCase().trim())) {
    return true;
  }
  // Numeric comparison: try to parse both sides as numbers
  const studentNum = Number(studentAnswer.trim());
  if (!isNaN(studentNum)) {
    return accepted.some((a: string) => {
      const accNum = Number(String(a).trim());
      return !isNaN(accNum) && Math.abs(studentNum - accNum) < 0.0001;
    });
  }
  return false;
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

      const isTextOnlyProvider = candidate.provider === "groq" || candidate.provider === "deepseek" || candidate.provider === "opencode";

      if (isTextOnlyProvider) {
        const textPrompt = prompt + "\n\nResponde SOLO con un JSON valido: {\"isCorrect\": true} o {\"isCorrect\": false}. No uses bloques de markdown ni texto adicional.";
        const resultText = await Promise.race([
          generateText({
            model,
            system: SEMANTIC_CHECK_PROMPT,
            prompt: textPrompt,
            maxOutputTokens: 30,
            temperature: 0,
          }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
        ]);

        if (!resultText) continue;

        try {
          const parsed = tryParseJson(resultText.text);
          return semanticCheckResponseSchema.parse(parsed).isCorrect;
        } catch {
          continue;
        }
      } else {
        // Race with timeout
        const result = await Promise.race([
          generateObject({
            model,
            schema: semanticCheckResponseSchema,
            system: SEMANTIC_CHECK_PROMPT,
            prompt,
            maxOutputTokens: 30,
            temperature: 0,
          }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
        ]);

        if (!result) continue;

        return result.object.isCorrect;
      }
    } catch (error) {
      if (!isRetryableModelError(error)) return null;
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
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
