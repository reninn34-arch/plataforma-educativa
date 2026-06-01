import { NextRequest, NextResponse } from "next/server";

/**
 * @swagger
 * /api/dashboard/student:
 *   get:
 *     summary: Dashboard del estudiante
 *     description: Devuelve perfil, progreso por materia, métricas de práctica y tareas recientes.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Datos del dashboard del estudiante
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profile:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     fullName: { type: string }
 *                     cedula: { type: string }
 *                     role: { type: string }
 *                     email: { type: string }
 *                 progress:
 *                   type: object
 *                   additionalProperties:
 *                     type: object
 *                     properties:
 *                       percentage: { type: integer }
 *                       completedNodes: { type: integer }
 *                       totalNodes: { type: integer }
 *                       totalStars: { type: integer }
 *                 metrics:
 *                   type: object
 *                   properties:
 *                     totalSessions: { type: integer }
 *                     totalQuestions: { type: integer }
 *                     totalCorrect: { type: integer }
 *                     totalScore: { type: integer }
 *                     bestScore: { type: integer }
 *                     avgScore: { type: integer }
 *                     accuracy: { type: integer }
 *                     streakDays: { type: integer }
 *                     gradeAverage: { type: number }
 *                     gradedCount: { type: integer }
 *                     recentSessions: { type: array }
 *                 assignments:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: No autorizado (no es estudiante)
 */
import { db } from "@/lib/db";
import { users, subjects, nodes, userProgress, modules, progress, practiceSessions, practiceAnswers, assignmentSubmissions, assignments, cursoEstudiantes, cursos } from "@/lib/db/schema";
import { eq, and, desc, inArray, isNotNull, sql } from "drizzle-orm";
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
    if (Math.round(diff) === 1) streak++;
    else break;
  }
  return streak;
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "student") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const [profileRow] = await db
      .select({ id: users.id, fullName: users.fullName, cedula: users.cedula, role: users.role, email: users.email })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    const progressRows = await db
      .select({
        id: subjects.id,
        slug: subjects.slug,
        name: subjects.name,
        emoji: subjects.emoji,
        totalNodes: sql<number>`count(distinct ${nodes.id})`,
        completedNodes: sql<number>`count(distinct case when ${userProgress.status} = 'completed' then ${nodes.id} end)`,
        totalStars: sql<number>`coalesce(sum(${userProgress.starsEarned}), 0)`,
      })
      .from(subjects)
      .leftJoin(modules, eq(modules.subjectId, subjects.id))
      .leftJoin(nodes, eq(nodes.moduleId, modules.id))
      .leftJoin(userProgress, and(eq(userProgress.nodeId, nodes.id), eq(userProgress.userId, user.id)))
      .groupBy(subjects.id);

    const progressData: Record<string, { percentage: number; completedNodes: number; totalNodes: number; totalStars: number }> = {};
    for (const row of progressRows) {
      const percentage = row.totalNodes > 0 ? Math.round((row.completedNodes / row.totalNodes) * 100) : 0;
      progressData[row.slug] = { percentage, completedNodes: row.completedNodes, totalNodes: row.totalNodes, totalStars: row.totalStars };
    }

    const allSessions = await db
      .select()
      .from(practiceSessions)
      .where(eq(practiceSessions.userId, user.id))
      .orderBy(desc(practiceSessions.createdAt))
      .limit(100);

    const sessionIds = allSessions.map(s => s.id);
    const answersWithSession = sessionIds.length > 0 ? await db
      .select({ sessionId: practiceAnswers.sessionId })
      .from(practiceAnswers)
      .where(and(eq(practiceAnswers.userId, user.id), inArray(practiceAnswers.sessionId, sessionIds))) : [];

    const validSessionIds = new Set(answersWithSession.map(a => a.sessionId));
    const validSessions = allSessions.filter(s => validSessionIds.has(s.id));

    const totalSessions = validSessions.length;
    const totalScore = validSessions.reduce((s, r) => s + r.score, 0);
    const totalCorrect = validSessions.reduce((s, r) => s + r.correctCount, 0);
    const totalQuestions = validSessions.reduce((s, r) => s + r.totalCount, 0);
    const bestScore = validSessions.length > 0 ? Math.max(...validSessions.map(s => s.score)) : 0;
    const sessionDates = validSessions.map(s => new Date(s.createdAt).toISOString().slice(0, 10));
    const streakDays = calculateStreak(sessionDates);

    const gradedSubmissions = await db
      .select({ grade: assignmentSubmissions.grade })
      .from(assignmentSubmissions)
      .where(and(eq(assignmentSubmissions.studentId, user.id), isNotNull(assignmentSubmissions.grade)));

    const grades = gradedSubmissions.map(s => s.grade).filter((g): g is number => g != null);
    const gradeAverage = grades.length > 0 ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length) : null;

    const enrolledCourses = await db
      .select({ cursoId: cursoEstudiantes.cursoId })
      .from(cursoEstudiantes)
      .where(eq(cursoEstudiantes.estudianteId, user.id));
    const enrolledIds = new Set(enrolledCourses.map(c => c.cursoId));

    let assignmentsData: any[] = [];
    if (enrolledIds.size > 0) {
      const raw = await db
        .select({
          id: assignments.id,
          title: assignments.title,
          description: assignments.description,
          dueDate: assignments.dueDate,
          createdAt: assignments.createdAt,
          teacherName: users.fullName,
          subjectName: subjects.name,
          subjectEmoji: subjects.emoji,
          subjectSlug: subjects.slug,
          cursoId: assignments.cursoId,
          cursoNombre: cursos.nombre,
          status: assignmentSubmissions.status,
          grade: assignmentSubmissions.grade,
        })
        .from(assignments)
        .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
        .leftJoin(users, eq(assignments.teacherId, users.id))
        .leftJoin(cursos, eq(assignments.cursoId, cursos.id))
        .leftJoin(assignmentSubmissions, and(eq(assignmentSubmissions.assignmentId, assignments.id), eq(assignmentSubmissions.studentId, user.id)))
        .orderBy(desc(assignments.createdAt))
        .limit(200);

      assignmentsData = (raw as any[]).filter((a: any) => enrolledIds.has(a.cursoId));
    }

    return NextResponse.json({
      profile: profileRow,
      progress: progressData,
      metrics: {
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
        recentSessions: validSessions.slice(0, 5),
      },
      assignments: assignmentsData,
    });
  } catch (error) {
    console.error("Student dashboard error:", error);
    return NextResponse.json({ error: "Error al cargar dashboard" }, { status: 500 });
  }
}