import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { practiceSessions, practiceAnswers } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { subjectId, correctCount, totalCount, score, maxCombo, answers } = await request.json();

    const [session] = await db
      .insert(practiceSessions)
      .values({
        userId: user.id,
        subjectId,
        correctCount,
        totalCount,
        score,
        maxCombo,
      })
      .returning();

    if (answers && answers.length > 0) {
      await db.insert(practiceAnswers).values(
        answers.map((a: { question: string; type: string; topic?: string; studentAnswer: string; isCorrect: boolean }) => ({
          sessionId: session.id,
          userId: user.id,
          subjectId,
          question: a.question,
          type: a.type,
          topic: a.topic || null,
          studentAnswer: a.studentAnswer,
          isCorrect: a.isCorrect,
        }))
      );
    }

    return NextResponse.json({ saved: true, sessionId: session.id });
  } catch (error) {
    console.error("Save session error:", error);
    return NextResponse.json({ error: "Error al guardar sesion" }, { status: 500 });
  }
}
