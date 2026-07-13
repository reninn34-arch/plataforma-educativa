/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Obtener conteo de notificaciones
 *     description: Devuelve el número de notificaciones no leídas según el rol (entregas sin calificar para docentes, tareas nuevas y calificaciones para estudiantes).
 *     tags: [Notificaciones]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Conteo de notificaciones no leídas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 unreadCount:
 *                   type: integer
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignments, assignmentSubmissions } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
  if (user.role === "teacher") {
    // Unread submissions count
    const [result] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(assignmentSubmissions)
      .leftJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id))
      .where(and(
        eq(assignments.teacherId, user.id),
        eq(assignmentSubmissions.status, "submitted")
      ));
    return NextResponse.json({ unreadCount: result?.count || 0 });
  }

  // Student: new assignments + unread grades
  const [newAssignments] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(assignments)
    .leftJoin(assignmentSubmissions, and(
      eq(assignmentSubmissions.assignmentId, assignments.id),
      eq(assignmentSubmissions.studentId, user.id)
    ))
    .where(sql`${assignmentSubmissions.id} is null`);

  const [newGrades] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(assignmentSubmissions)
    .where(and(
      eq(assignmentSubmissions.studentId, user.id),
      eq(assignmentSubmissions.status, "graded")
    ));

  return NextResponse.json({
    unreadCount: (newAssignments?.count || 0) + (newGrades?.count || 0),
  });
  } catch {
    return NextResponse.json({ error: "Error al cargar notificaciones" }, { status: 500 });
  }
}
