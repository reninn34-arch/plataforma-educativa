import { NextRequest, NextResponse } from "next/server";

/**
 * @swagger
 * /api/analytics/overview:
 *   get:
 *     summary: Estadísticas de práctica con IA
 *     description: Devuelve métricas agregadas de sesiones de práctica con IA (por materia, estudiante y temas con errores).
 *     tags: [Analíticas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cursoId
 *         schema: { type: integer }
 *         description: Filtrar por curso
 *     responses:
 *       200:
 *         description: Estadísticas de práctica
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 overall:
 *                   type: object
 *                   properties:
 *                     totalSessions: { type: integer }
 *                     totalAnswers: { type: integer }
 *                     avgScore: { type: number }
 *                     avgCorrect: { type: number }
 *                 bySubject:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       subjectId: { type: integer }
 *                       subjectName: { type: string }
 *                       subjectEmoji: { type: string }
 *                       totalAnswers: { type: integer }
 *                       correctCount: { type: integer }
 *                       percentage: { type: number }
 *                 byStudent:
 *                   type: array
 *                 errorTopics:
 *                   type: array
 */
import { db } from "@/lib/db";
import { practiceSessions, practiceAnswers, users, subjects, cursoEstudiantes, cursoProfesores, cursos } from "@/lib/db/schema";
import { eq, sql, desc, inArray, and } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { getTeacherCourseIds } from "@/lib/course-helpers";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
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

    // Si el docente NO es tutor de ninguno de estos cursos, filtrar solo su materia asignada
    let subjectFilter: number[] | null = null;
    if (targetCursoIds.length > 0) {
      const tutorCourses = await db
        .select({ id: cursos.id })
        .from(cursos)
        .where(and(eq(cursos.profesorId, user.id), inArray(cursos.id, targetCursoIds)));

      const isTutorOfAnySelected = tutorCourses.length > 0;

      if (!isTutorOfAnySelected) {
        const teacherSubjects = await db
          .select({ subjectId: cursoProfesores.subjectId })
          .from(cursoProfesores)
          .where(and(
            eq(cursoProfesores.teacherId, user.id),
            inArray(cursoProfesores.cursoId, targetCursoIds)
          ));
        subjectFilter = [...new Set(teacherSubjects.map(r => r.subjectId))];
      }
    }

    const buildWhere = (baseConditions: any[]) => {
      if (subjectFilter && subjectFilter.length > 0) {
        baseConditions.push(inArray(practiceAnswers.subjectId, subjectFilter));
      }
      return and(...baseConditions);
    };

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
        .where(and(...[
          inArray(practiceSessions.userId, studentIds),
          ...(subjectFilter && subjectFilter.length > 0
            ? [inArray(practiceSessions.subjectId, subjectFilter)]
            : []),
        ]))
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
        .where(buildWhere([inArray(practiceAnswers.userId, studentIds)]))
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
        .where(buildWhere([inArray(practiceSessions.userId, studentIds)]))
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
        .where(buildWhere([eq(practiceAnswers.isCorrect, false), inArray(practiceAnswers.userId, studentIds)]))
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
