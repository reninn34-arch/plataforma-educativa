/**
 * @swagger
 * /api/student/calendar:
 *   get:
 *     summary: Calendario del estudiante
 *     description: Devuelve los eventos del calendario (tareas con fecha de entrega) para el estudiante o profesor autenticado.
 *     tags: [Estudiantes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Eventos del calendario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 events:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       title: { type: string }
 *                       subjectName: { type: string }
 *                       subjectEmoji: { type: string }
 *                       subjectSlug: { type: string }
 *                       dueDate: { type: string, nullable: true }
 *                       status: { type: string, nullable: true }
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignments, assignmentSubmissions, subjects, cursoEstudiantes } from "@/lib/db/schema";
import { eq, and, inArray, isNotNull, sql } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any[] = [];

  if (user.role === "student") {
    const enrolledCourses = await db
      .select({ cursoId: cursoEstudiantes.cursoId })
      .from(cursoEstudiantes)
      .where(eq(cursoEstudiantes.estudianteId, user.id));

    const enrolledIds = new Set(enrolledCourses.map(c => c.cursoId));

    if (enrolledIds.size === 0) {
      data = [];
    } else {
      data = await db
        .select({
          id: assignments.id,
          title: assignments.title,
          subjectName: subjects.name,
          subjectEmoji: subjects.emoji,
          subjectSlug: subjects.slug,
          dueDate: assignments.dueDate,
          status: assignmentSubmissions.status,
        })
        .from(assignments)
        .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
        .leftJoin(assignmentSubmissions, and(
          eq(assignmentSubmissions.assignmentId, assignments.id),
          eq(assignmentSubmissions.studentId, user.id)
        ))
        .where(and(
          isNotNull(assignments.dueDate),
          isNotNull(assignments.cursoId),
          inArray(assignments.cursoId, Array.from(enrolledIds))
        ));
    }
  } else {
    // Teacher sees all assignments
    const raw = await db
      .select({
        id: assignments.id,
        title: assignments.title,
        subjectName: subjects.name,
        subjectEmoji: subjects.emoji,
        dueDate: assignments.dueDate,
      })
      .from(assignments)
      .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
      .where(and(
        eq(assignments.teacherId, user.id),
        isNotNull(assignments.dueDate)
      ));

    const ids = raw.map(a => a.id);
    const counts = ids.length > 0 ? await db
      .select({
        assignmentId: assignmentSubmissions.assignmentId,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(assignmentSubmissions)
      .where(inArray(assignmentSubmissions.assignmentId, ids))
      .groupBy(assignmentSubmissions.assignmentId) : [];
    const countMap = new Map(counts.map(c => [c.assignmentId, c.count]));

    data = raw.map(a => ({ ...a, submissionCount: countMap.get(a.id) || 0 }));
  }

  return NextResponse.json({ events: data });
  } catch {
    return NextResponse.json({ error: "Error al cargar calendario" }, { status: 500 });
  }
}
