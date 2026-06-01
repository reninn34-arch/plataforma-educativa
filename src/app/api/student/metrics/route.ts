import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  practiceSessions,
  practiceAnswers,
  assignmentSubmissions,
  subjects,
} from "@/lib/db/schema";
import { eq, and, desc, inArray, isNotNull } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

function calculateStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const uniqueDays = [...new Set(dates)].sort().reverse();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const mostRecent = new Date(uniqueDays[0]);
  const diffFromToday = (today.getTime() - mostRecent.getTime()) / (1000 * 60 * 60 * 24);

  if (diffFromToday > 1) return 0;

  let streak = 1;
  for (let i = 1; i < uniqueDays.length; i++) {
    const prev = new Date(uniqueDays[i - 1]);
    const curr = new Date(uniqueDays[i]);
    const diff = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
    if (Math.round(diff) === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "student") return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
  const allSessions = await db
    .select()
    .from(practiceSessions)
    .where(eq(practiceSessions.userId, user.id))
    .orderBy(desc(practiceSessions.createdAt))
    .limit(100);

  if (allSessions.length === 0) {
    return NextResponse.json({
      totalSessions: 0,
      totalQuestions: 0,
      totalCorrect: 0,
      totalScore: 0,
      bestScore: 0,
      avgScore: 0,
      accuracy: 0,
      streakDays: 0,
      gradeAverage: null,
      gradedCount: 0,
      bySubject: [],
      recentSessions: [],
    });
  }

  const sessionIds = allSessions.map(s => s.id);

  const [answersWithSession, answers, gradedSubmissions] = await Promise.all([
    db.select({ sessionId: practiceAnswers.sessionId })
      .from(practiceAnswers)
      .where(
        and(
          eq(practiceAnswers.userId, user.id),
          inArray(practiceAnswers.sessionId, sessionIds)
        )
      ),
    db.select({
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
      .limit(50),
    db.select({ grade: assignmentSubmissions.grade })
      .from(assignmentSubmissions)
      .where(
        and(
          eq(assignmentSubmissions.studentId, user.id),
          isNotNull(assignmentSubmissions.grade)
        )
      )
  ]);

  const validSessionIds = new Set(answersWithSession.map(a => a.sessionId));
  const validSessions = allSessions.filter(s => validSessionIds.has(s.id));

  const totalSessions = validSessions.length;
  const totalScore = validSessions.reduce((s, r) => s + r.score, 0);
  const totalCorrect = validSessions.reduce((s, r) => s + r.correctCount, 0);
  const totalQuestions = validSessions.reduce((s, r) => s + r.totalCount, 0);
  const bestScore = validSessions.length > 0 ? Math.max(...validSessions.map(s => s.score)) : 0;

  const sessionDates = validSessions.map(s =>
    new Date(s.createdAt).toISOString().slice(0, 10)
  );
  const streakDays = calculateStreak(sessionDates);

  // Per subject practice stats

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
    streakDays,
    gradeAverage,
    gradedCount: grades.length,
    bySubject,
    recentSessions: validSessions.slice(0, 5),
  });
  } catch {
    return NextResponse.json({ error: "Error al cargar metricas" }, { status: 500 });
  }
}
