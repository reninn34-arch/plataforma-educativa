import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { practiceSessions, practiceAnswers, users, subjects, cursoEstudiantes } from "@/lib/db/schema";
import { eq, sql, desc, inArray, and } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { getTeacherCourseIds } from "@/lib/course-helpers";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "Solo docentes" }, { status: 403 });
  }

  const cursoIdParam = request.nextUrl.searchParams.get("cursoId");

  try {
    const allIds = await getTeacherCourseIds(user.id);

    let targetCursoIds: number[];
    if (cursoIdParam) {
      const cid = parseInt(cursoIdParam);
      if (!allIds.includes(cid)) {
        return NextResponse.json({ error: "No tienes acceso a este curso" }, { status: 403 });
      }
      targetCursoIds = [cid];
    } else {
      targetCursoIds = allIds;
    }

    let studentIds: number[] = [];
    if (targetCursoIds.length > 0) {
      const enrolled = await db
        .select({ estudianteId: cursoEstudiantes.estudianteId })
        .from(cursoEstudiantes)
        .where(inArray(cursoEstudiantes.cursoId, targetCursoIds));
      studentIds = [...new Set(enrolled.map(r => r.estudianteId))];
    }

    const [overall] = studentIds.length > 0
      ? await db
        .select({
          totalSessions: sql<number>`count(distinct ${practiceSessions.id})`.mapWith(Number),
          totalAnswers: sql<number>`count(${practiceAnswers.id})`.mapWith(Number),
          avgScore: sql<number>`round(avg(${practiceSessions.score}))`.mapWith(Number),
          avgCorrect: sql<number>`round(avg(case when ${practiceSessions.totalCount} > 0 then cast(${practiceSessions.correctCount} as numeric) / cast(${practiceSessions.totalCount} as numeric) * 100 else null end))`.mapWith(Number),
        })
        .from(practiceSessions)
        .leftJoin(practiceAnswers, eq(practiceAnswers.sessionId, practiceSessions.id))
        .where(inArray(practiceSessions.userId, studentIds))
      : [null];

    const bySubject = studentIds.length > 0
      ? await db
        .select({
          subjectId: subjects.id,
          subjectName: subjects.name,
          subjectEmoji: subjects.emoji,
          totalAnswers: sql<number>`count(${practiceAnswers.id})`.mapWith(Number),
          correctCount: sql<number>`sum(case when ${practiceAnswers.isCorrect} then 1 else 0 end)`.mapWith(Number),
        })
        .from(practiceAnswers)
        .leftJoin(subjects, eq(practiceAnswers.subjectId, subjects.id))
        .where(inArray(practiceAnswers.userId, studentIds))
        .groupBy(subjects.id, subjects.name, subjects.emoji)
        .orderBy(subjects.name)
      : [];

    const byStudent = studentIds.length > 0
      ? await db
        .select({
          userId: users.id,
          fullName: users.fullName,
          cedula: users.cedula,
          sessions: sql<number>`count(distinct ${practiceSessions.id})`.mapWith(Number),
          avgScore: sql<number>`round(avg(${practiceSessions.score}))`.mapWith(Number),
          totalCorrect: sql<number>`sum(case when ${practiceAnswers.isCorrect} then 1 else 0 end)`.mapWith(Number),
          totalAnswers: sql<number>`count(${practiceAnswers.id})`.mapWith(Number),
        })
        .from(practiceSessions)
        .leftJoin(users, eq(practiceSessions.userId, users.id))
        .leftJoin(practiceAnswers, eq(practiceAnswers.sessionId, practiceSessions.id))
        .where(inArray(practiceSessions.userId, studentIds))
        .groupBy(users.id, users.fullName, users.cedula)
        .orderBy(desc(sql`avg(${practiceSessions.score})`))
      : [];

    const errorTopics = studentIds.length > 0
      ? await db
        .select({
          topic: practiceAnswers.topic,
          subjectName: subjects.name,
          subjectEmoji: subjects.emoji,
          wrongCount: sql<number>`count(*)`.mapWith(Number),
        })
        .from(practiceAnswers)
        .leftJoin(subjects, eq(practiceAnswers.subjectId, subjects.id))
        .where(and(eq(practiceAnswers.isCorrect, false), inArray(practiceAnswers.userId, studentIds)))
        .groupBy(practiceAnswers.topic, subjects.name, subjects.emoji)
        .orderBy(desc(sql`count(*)`))
        .limit(10)
      : [];

    return NextResponse.json({
      overall,
      bySubject: bySubject.map(s => ({
        ...s,
        percentage: s.totalAnswers > 0 ? Math.round((s.correctCount / s.totalAnswers) * 100) : 0,
      })),
      byStudent: byStudent.map(s => ({
        ...s,
        percentage: s.totalAnswers > 0 ? Math.round((s.totalCorrect / s.totalAnswers) * 100) : 0,
      })),
      errorTopics,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json({ error: "Error al cargar analiticas" }, { status: 500 });
  }
}
