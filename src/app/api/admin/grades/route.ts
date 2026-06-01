import { NextRequest, NextResponse } from "next/server";

/**
 * @swagger
 * /api/admin/grades:
 *   get:
 *     summary: Ver calificaciones
 *     description: Devuelve todas las calificaciones con información de estudiante, materia y curso.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cursoId
 *         schema: { type: integer }
 *         description: Filtrar por curso
 *     responses:
 *       200:
 *         description: Lista de calificaciones con datos del estudiante y assignment
 *       403:
 *         description: Solo administradores
 */
import { db } from "@/lib/db";
import { assignments, assignmentSubmissions, subjects, users, cursos } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const cursoId = searchParams.get("cursoId");
  const limit = Math.min(Number(searchParams.get("limit")) || 500, 1000);

  try {
    const conditions = [];
    if (cursoId) {
      const cursoNum = Number(cursoId);
      if (!isNaN(cursoNum)) conditions.push(eq(assignments.cursoId, cursoNum));
    }

    const query = db
      .select({
        cursoId: cursos.id,
        cursoNombre: cursos.nombre,
        studentId: users.id,
        studentName: users.fullName,
        studentCedula: users.cedula,
        subjectName: subjects.name,
        subjectEmoji: subjects.emoji,
        assignmentTitle: assignments.title,
        trimester: assignments.trimester,
        grade: assignmentSubmissions.grade,
        status: assignmentSubmissions.status,
        submittedAt: assignmentSubmissions.submittedAt,
      })
      .from(assignmentSubmissions)
      .leftJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id))
      .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
      .leftJoin(users, eq(assignmentSubmissions.studentId, users.id))
      .leftJoin(cursos, eq(assignments.cursoId, cursos.id));

    const data = await (conditions.length > 0
      ? query.where(and(...conditions)).limit(limit)
      : query.limit(limit));

    return NextResponse.json({ grades: data });
  } catch (error) {
    console.error("Admin grades error:", error);
    return NextResponse.json({ error: "Error al cargar notas" }, { status: 500 });
  }
}
