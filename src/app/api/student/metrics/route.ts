import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  practiceSessions,
  practiceAnswers,
  assignmentSubmissions,
  subjects,
} from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user || user.role !== "student") return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Overall practice stats
  const sessions = await db
    .select()
    .from(practiceSessions)
    .where(eq(practiceSessions.userId, user.id))
    .orderBy(desc(practiceSessions.createdAt))
    .limit(20);

  const totalSessions = sessions.length;
  const totalScore = sessions.reduce((s, r) => s + r.score, 0);
  const totalCorrect = sessions.reduce((s, r) => s + r.correctCount, 0);
  const totalQuestions = sessions.reduce((s, r) => s + r.totalCount, 0);
  const bestScore = sessions.length > 0 ? Math.max(...sessions.map(s => s.score)) : 0;

  // Per subject practice stats
  const answers = await db
    .select({
      subjectName: subjects.name,
      subjectEmoji: subjects.emoji,
      isCorrect: practiceAnswers.isCorrect,
      question: practiceAnswers.question,
      type: practiceAnswers.type,
    })
    .from(practiceAnswers)
    .leftJoin(subjects, eq(practiceAnswers.subjectId, subjects.id))
    .where(eq(practiceAnswers.userId, user.id))
    .orderBy(desc(practiceAnswers.createdAt))
    .limit(50);

  const subjectMap = new Map<string, { emoji: string; correct: number; total: number; wrongQuestions: string[] }>();
  answers.forEach(a => {
    const key = a.subjectName || "General";
    if (!subjectMap.has(key)) subjectMap.set(key, { emoji: a.subjectEmoji || "", correct: 0, total: 0, wrongQuestions: [] });
    const s = subjectMap.get(key)!;
    s.total++;
    if (a.isCorrect) s.correct++;
    else s.wrongQuestions.push(a.question);
  });

  const bySubject = Array.from(subjectMap.entries()).map(([name, s]) => ({
    subjectName: name,
    subjectEmoji: s.emoji,
    percentage: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
    correct: s.correct,
    total: s.total,
    topMistakes: s.wrongQuestions.slice(0, 3),
  }));

  // Grade average from real assignments
  const gradedSubmissions = await db
    .select({ grade: assignmentSubmissions.grade })
    .from(assignmentSubmissions)
    .where(
      and(
        eq(assignmentSubmissions.studentId, user.id),
        eq(assignmentSubmissions.status, "graded")
      )
    );

  const grades = gradedSubmissions
    .map(s => s.grade)
    .filter((g): g is number => g != null);

  const gradeAverage = grades.length > 0
    ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length)
    : null;

  return NextResponse.json({
    totalSessions,
    totalQuestions,
    totalCorrect,
    totalScore,
    bestScore,
    avgScore: totalSessions > 0 ? Math.round(totalScore / totalSessions) : 0,
    accuracy: totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
    gradeAverage,
    gradedCount: grades.length,
    bySubject,
    recentSessions: sessions.slice(0, 5),
  });
}
