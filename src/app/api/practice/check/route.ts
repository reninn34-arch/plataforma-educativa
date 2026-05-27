import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { opencodeGoModel } from "@/lib/ai";
import { generateText } from "ai";
import { practiceCheckSchema } from "@/lib/api-helpers";

const SEMANTIC_CHECK_PROMPT = `Eres un evaluador de respuestas para ejercicios de completar espacios (fill in the blank) en bachillerato acelerado para adultos (PCEI). Tu unica tarea es determinar si la respuesta del estudiante es SEMANTICAMENTE EQUIVALENTE a alguna de las respuestas aceptadas.

REGLAS ESTRICTAS:
1. Responde UNICAMENTE con un JSON valido: {"isCorrect": true/false}
2. "isCorrect": true SOLO si la respuesta del estudiante significa lo mismo que al menos una respuesta aceptada, aunque use sinonimos, mayusculas/minusculas diferentes, o pequenas variaciones gramaticales.
3. "isCorrect": false si la respuesta es semantica o conceptualmente incorrecta.
4. No seas demasiado laxo. Errores conceptuales = false.`;

function isDeterministicMatch(studentAnswer: string, accepted: string[]): boolean {
  return accepted.some((a: string) =>
    String(a).toLowerCase().trim() === String(studentAnswer).toLowerCase().trim()
  );
}

async function aiSemanticCheck(
  question: string,
  studentAnswer: string,
  acceptedAnswers: string[]
): Promise<boolean | null> {
  try {
    const result = await Promise.race([
      generateText({
        model: opencodeGoModel,
        system: SEMANTIC_CHECK_PROMPT,
        prompt: `Pregunta: ${question}\n\nRespuesta del estudiante: "${studentAnswer}"\n\nRespuestas aceptadas: ${JSON.stringify(acceptedAnswers)}\n\nEvalua si la respuesta del estudiante es semanticamente equivalente a alguna de las aceptadas. Responde solo con el JSON.`,
        maxOutputTokens: 30,
        temperature: 0,
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
    ]);

    if (!result) return null;

    const text = result.text.trim();
    const parsed = JSON.parse(text);
    if (typeof parsed.isCorrect === "boolean") return parsed.isCorrect;
    return null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const parsed = practiceCheckSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Datos invalidos" }, { status: 400 });
    }
    const { question, type, studentAnswer, correctAnswer } = parsed.data;

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
        const aiResult = await aiSemanticCheck(question, String(studentAnswer), accepted);
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
