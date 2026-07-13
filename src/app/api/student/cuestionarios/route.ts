/**
 * @swagger
 * /api/student/cuestionarios:
 *   get:
 *     summary: Listar cuestionarios del estudiante
 *     description: Devuelve todos los cuestionarios disponibles para el estudiante autenticado según los cursos en los que está inscrito.
 *     tags: [Estudiantes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de cuestionarios
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cuestionarios:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       title: { type: string }
 *                       description: { type: string, nullable: true }
 *                       subjectName: { type: string }
 *                       subjectEmoji: { type: string }
 *                       subjectSlug: { type: string }
 *                       cursoNombre: { type: string, nullable: true }
 *                       cursoNivel: { type: string, nullable: true }
 *                       createdAt: { type: string }
 *                       teacherId: { type: integer }
 *                       preguntaCount: { type: integer }
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cuestionarios, cuestionarioPreguntas, subjects, cursos, cursoEstudiantes } from "@/lib/db/schema";
import { eq, inArray, desc, sql } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "student") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const enrolledCourses = await db
      .select({ cursoId: cursoEstudiantes.cursoId })
      .from(cursoEstudiantes)
      .where(eq(cursoEstudiantes.estudianteId, user.id));

    const courseIds = enrolledCourses.map(c => c.cursoId);
    if (courseIds.length === 0) {
      return NextResponse.json({ cuestionarios: [] });
    }

    const list = await db
      .select({
        id: cuestionarios.id,
        title: cuestionarios.title,
        description: cuestionarios.description,
        subjectName: subjects.name,
        subjectEmoji: subjects.emoji,
        subjectSlug: subjects.slug,
        cursoNombre: cursos.nombre,
        cursoNivel: cursos.nivel,
        createdAt: cuestionarios.createdAt,
        teacherId: cuestionarios.teacherId,
      })
      .from(cuestionarios)
      .innerJoin(subjects, eq(subjects.id, cuestionarios.subjectId))
      .leftJoin(cursos, eq(cursos.id, cuestionarios.cursoId))
      .where(inArray(cuestionarios.cursoId, courseIds))
      .orderBy(desc(cuestionarios.createdAt));

    const cuestionariosWithCount = await Promise.all(
      list.map(async (c) => {
        const [countResult] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(cuestionarioPreguntas)
          .where(eq(cuestionarioPreguntas.cuestionarioId, c.id));
        return { ...c, preguntaCount: countResult?.count || 0 };
      })
    );

    return NextResponse.json({ cuestionarios: cuestionariosWithCount });
  } catch (error) {
    console.error("[cuestionarios] error:", error);
    return NextResponse.json({ error: "Error al cargar cuestionarios" }, { status: 500 });
  }
}
