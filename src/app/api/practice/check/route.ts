import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { question, type, studentAnswer, correctAnswer, options } = await request.json();

    let isCorrect = false;

    if (type === "mcq") {
      isCorrect = Number(studentAnswer) === Number(correctAnswer);
    } else if (type === "true_false") {
      const studentBool = studentAnswer === true || studentAnswer === "true";
      const correctBool = correctAnswer === true || correctAnswer === "true";
      isCorrect = studentBool === correctBool;
    } else if (type === "fill_blank") {
      const accepted: string[] = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer].filter(Boolean);
      isCorrect = accepted.some((a: string) =>
        String(a).toLowerCase().trim() === String(studentAnswer).toLowerCase().trim()
      );
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
