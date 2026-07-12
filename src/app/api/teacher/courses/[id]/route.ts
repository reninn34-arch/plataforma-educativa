/**
 * @swagger
 * /api/teacher/courses/{id}:
 *   get:
 *     summary: Obtener detalle de un curso
 *     description: Devuelve la información detallada de un curso y las materias que imparte el docente en él.
 *     tags: [Docentes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del curso
 *     responses:
 *       200:
 *         description: Detalle del curso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: integer }
 *                 nombre: { type: string }
 *                 nivel: { type: string }
 *                 profesorId: { type: integer }
 *                 profesorNombre: { type: string }
 *                 activo: { type: boolean }
 *                 isTutor: { type: boolean }
 *                 mySubjects:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       subjectId: { type: integer }
 *                       subjectName: { type: string }
 *                       subjectEmoji: { type: string }
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo profesores
 *       404:
 *         description: Curso no encontrado
 *       500:
 *         description: Error interno
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cursos, cursoEstudiantes, cursoProfesores, users, subjects } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { teacherHasCourseAccess } from "@/lib/course-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const teacher = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!teacher || teacher.role !== "teacher") {
    return NextResponse.json({ error: "Solo profesores" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const cursoId = parseInt(id);

    const hasAccess = await teacherHasCourseAccess(teacher.id, cursoId);
    if (!hasAccess) {
      return NextResponse.json({ error: "No tienes acceso a este curso" }, { status: 403 });
    }

    const [curso] = await db
      .select({
        id: cursos.id,
        nombre: cursos.nombre,
        nivel: cursos.nivel,
        profesorId: cursos.profesorId,
        profesorNombre: users.fullName,
        activo: cursos.activo,
      })
      .from(cursos)
      .leftJoin(users, eq(cursos.profesorId, users.id))
      .where(eq(cursos.id, cursoId));

    if (!curso) {
      return NextResponse.json({ error: "Curso no encontrado" }, { status: 404 });
    }

    const mySubjects = await db
      .select({
        subjectId: cursoProfesores.subjectId,
        subjectName: subjects.name,
        subjectEmoji: subjects.emoji,
      })
      .from(cursoProfesores)
      .innerJoin(subjects, eq(cursoProfesores.subjectId, subjects.id))
      .where(and(eq(cursoProfesores.cursoId, cursoId), eq(cursoProfesores.teacherId, teacher.id)));

    return NextResponse.json({
      ...curso,
      isTutor: curso.profesorId === teacher.id,
      mySubjects,
    });
  } catch (error) {
    console.error("Teacher course detail error:", error);
    return NextResponse.json({ error: "Error al cargar curso" }, { status: 500 });
  }
}
