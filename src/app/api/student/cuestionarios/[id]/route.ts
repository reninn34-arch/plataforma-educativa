/**
 * @swagger
 * /api/student/cuestionarios/{id}:
 *   get:
 *     summary: Detalle de un cuestionario
 *     description: Devuelve la información de un cuestionario específico junto con todas sus preguntas.
 *     tags: [Estudiantes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del cuestionario
 *     responses:
 *       200:
 *         description: Detalle del cuestionario con preguntas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cuestionario:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     title: { type: string }
 *                     description: { type: string, nullable: true }
 *                     subjectName: { type: string }
 *                     subjectEmoji: { type: string }
 *                     subjectSlug: { type: string }
 *                     cursoNombre: { type: string, nullable: true }
 *                     cursoNivel: { type: string, nullable: true }
 *                     teacherName: { type: string }
 *                     createdAt: { type: string }
 *                 preguntas:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       type: { type: string }
 *                       question: { type: string }
 *                       options: { type: array, items: { type: string } }
 *                       correctIndex: { type: integer }
 *                       explanation: { type: string, nullable: true }
 *                       orderIndex: { type: integer }
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Cuestionario no encontrado
 *       500:
 *         description: Error interno
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  cuestionarios, cuestionarioPreguntas, subjects, cursos,
  users,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "student") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const [cuestionario] = await db
      .select({
        id: cuestionarios.id,
        title: cuestionarios.title,
        description: cuestionarios.description,
        subjectName: subjects.name,
        subjectEmoji: subjects.emoji,
        subjectSlug: subjects.slug,
        cursoNombre: cursos.nombre,
        cursoNivel: cursos.nivel,
        teacherName: users.fullName,
        createdAt: cuestionarios.createdAt,
      })
      .from(cuestionarios)
      .innerJoin(subjects, eq(subjects.id, cuestionarios.subjectId))
      .leftJoin(cursos, eq(cursos.id, cuestionarios.cursoId))
      .innerJoin(users, eq(users.id, cuestionarios.teacherId))
      .where(eq(cuestionarios.id, parseInt(id)))
      .limit(1);

    if (!cuestionario) {
      return NextResponse.json({ error: "Cuestionario no encontrado" }, { status: 404 });
    }

    const preguntas = await db
      .select({
        id: cuestionarioPreguntas.id,
        type: cuestionarioPreguntas.type,
        question: cuestionarioPreguntas.question,
        options: cuestionarioPreguntas.options,
        correctIndex: cuestionarioPreguntas.correctIndex,
        explanation: cuestionarioPreguntas.explanation,
        orderIndex: cuestionarioPreguntas.orderIndex,
      })
      .from(cuestionarioPreguntas)
      .where(eq(cuestionarioPreguntas.cuestionarioId, parseInt(id)))
      .orderBy(cuestionarioPreguntas.orderIndex);

    return NextResponse.json({ cuestionario, preguntas });
  } catch (error) {
    console.error("[cuestionario detail] error:", error);
    return NextResponse.json({ error: "Error al cargar cuestionario" }, { status: 500 });
  }
}
