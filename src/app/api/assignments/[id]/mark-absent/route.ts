/**
 * @swagger
 * /api/assignments/{id}/mark-absent:
 *   post:
 *     summary: Marcar estudiante como ausente
 *     description: Registra una entrega con nota 0 y feedback "No entrego" para un estudiante que no presentó la tarea. Solo el profesor dueño de la tarea.
 *     tags: [Tareas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: ID de la tarea
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [studentId]
 *             properties:
 *               studentId:
 *                 type: integer
 *                 description: "ID del estudiante a marcar como ausente"
 *     responses:
 *       200:
 *         description: Estudiante marcado como ausente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *       400:
 *         description: Datos inválidos (falta studentId, estudiante ya tiene entrega, o no pertenece al curso)
 *       403:
 *         description: Solo docentes o no autorizado
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignments, assignmentSubmissions, cursoEstudiantes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get("atlas-edu-token")?.value;
    const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
    if (!user || user.role !== "teacher") {
      return NextResponse.json({ error: "Solo docentes" }, { status: 403 });
    }

    const { id } = await params;
    const assignmentId = parseInt(id);
    const { studentId } = await request.json();

    if (!studentId) {
      return NextResponse.json({ error: "studentId requerido" }, { status: 400 });
    }

    const [assg] = await db
      .select({ teacherId: assignments.teacherId, cursoId: assignments.cursoId })
      .from(assignments)
      .where(eq(assignments.id, assignmentId))
      .limit(1);

    if (!assg || assg.teacherId !== user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    if (assg.cursoId) {
      const enrolled = await db
        .select({ id: cursoEstudiantes.id })
        .from(cursoEstudiantes)
        .where(and(
          eq(cursoEstudiantes.cursoId, assg.cursoId),
          eq(cursoEstudiantes.estudianteId, studentId)
        ))
        .limit(1);
      if (!enrolled.length) {
        return NextResponse.json({ error: "El estudiante no pertenece a este curso" }, { status: 400 });
      }
    }

    const [existing] = await db
      .select({ id: assignmentSubmissions.id })
      .from(assignmentSubmissions)
      .where(and(
        eq(assignmentSubmissions.assignmentId, assignmentId),
        eq(assignmentSubmissions.studentId, studentId)
      ))
      .limit(1);

    if (existing) {
      return NextResponse.json({ error: "El estudiante ya tiene una entrega" }, { status: 400 });
    }

    await db
      .insert(assignmentSubmissions)
      .values({
        assignmentId,
        studentId,
        status: "graded",
        grade: 0,
        feedback: "No entrego",
      } as any);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/assignments/[id]/mark-absent error:", error);
    return NextResponse.json({ error: "Error al marcar como no entregado" }, { status: 500 });
  }
}
