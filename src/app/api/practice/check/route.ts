import { NextRequest } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

const FEEDBACK_PROMPT = `Eres un tutor socratico. Evalua la respuesta del estudiante.

REGLAS:
1. Si es correcta: felicita brevemente y refuerza el concepto (max 2 oraciones).
2. Si es incorrecta: NO des la respuesta. Da una pista logica y motiva a intentar de nuevo (max 2 oraciones).
3. Lenguaje motivador y sencillo.
4. NO uses jerga tecnica innecesaria.`;

export async function POST(request: NextRequest) {
  try {
    const { question, type, studentAnswer, correctAnswer, options } = await request.json();

    let isCorrect = false;

    if (type === "mcq") {
      isCorrect = studentAnswer === correctAnswer;
    } else if (type === "true_false") {
      isCorrect = studentAnswer === correctAnswer;
    } else if (type === "fill_blank") {
      const accepted: string[] = correctAnswer || [];
      isCorrect = accepted.some((a: string) =>
        a.toLowerCase().trim() === studentAnswer?.toLowerCase().trim()
      );
    }

    const result = await generateText({
      model: openai("gpt-4o-mini"),
      system: FEEDBACK_PROMPT,
      prompt: `Pregunta: ${question}
Tipo: ${type}
${options ? `Opciones: ${options.join(", ")}` : ""}
Respuesta correcta: ${JSON.stringify(correctAnswer)}
Respuesta del estudiante: ${studentAnswer}
Es correcta: ${isCorrect}

Genera feedback para el estudiante:`,
      maxOutputTokens: 100,
      temperature: 0.7,
    });

    return Response.json({ isCorrect, feedback: result.text });
  } catch (error) {
    console.error("Check answer error:", error);
    return Response.json(
      { error: "Error al evaluar la respuesta." },
      { status: 500 }
    );
  }
}
