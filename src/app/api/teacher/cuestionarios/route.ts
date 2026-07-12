/**
 * @swagger
 * /api/teacher/cuestionarios:
 *   get:
 *     summary: Listar cuestionarios del docente
 *     description: Devuelve todos los cuestionarios creados por el docente, con conteo de preguntas.
 *     tags: [Docentes]
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
 *                       preguntaCount: { type: integer }
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo docentes
 *       500:
 *         description: Error interno
 *   post:
 *     summary: Crear un cuestionario
 *     description: Crea un nuevo cuestionario con preguntas de tipo MCQ o completar.
 *     tags: [Docentes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subjectId, title, questions]
 *             properties:
 *               cursoId:
 *                 type: integer
 *                 description: ID del curso (opcional)
 *               subjectId:
 *                 type: integer
 *                 description: ID de la materia
 *               title:
 *                 type: string
 *                 description: Título del cuestionario
 *               description:
 *                 type: string
 *                 description: Descripción opcional
 *               questions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     virtualType:
 *                       type: string
 *                       enum: [mcq, completar]
 *                       description: Tipo de pregunta
 *                     question:
 *                       type: string
 *                       description: Enunciado de la pregunta
 *                     options:
 *                       type: array
 *                       items: { type: string }
 *                       description: Opciones de respuesta
 *                     correctIndex:
 *                       type: integer
 *                       description: Índice de la respuesta correcta
 *                     explanation:
 *                       type: string
 *                       description: Explicación de la respuesta
 *                     points:
 *                       type: integer
 *                       description: Puntos de la pregunta
 *     responses:
 *       201:
 *         description: Cuestionario creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 cuestionarioId: { type: integer }
 *                 mensaje: { type: string }
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo docentes
 *       500:
 *         description: Error interno
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  cuestionarios, cuestionarioPreguntas, subjects, cursos,
} from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { notifyStudentsInCourse } from "@/lib/notifications";
import { teacherHasCourseAccess } from "@/lib/course-helpers";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "Solo docentes" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { cursoId, subjectId, title, description, questions } = body;

    if (!subjectId || !title?.trim()) {
      return NextResponse.json({ error: "Materia y titulo son requeridos" }, { status: 400 });
    }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: "Debe incluir al menos una pregunta" }, { status: 400 });
    }

    if (cursoId) {
      const hasAccess = await teacherHasCourseAccess(user.id, cursoId);
      if (!hasAccess) {
        return NextResponse.json({ error: "No tienes acceso a este curso" }, { status: 403 });
      }
    }

    const [cuestionario] = await db.insert(cuestionarios).values({
      teacherId: user.id,
      subjectId,
      cursoId: cursoId || null,
      title: title.trim(),
      description: description?.trim() || null,
      trimester: 1,
    } as any).returning();

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const qType = q.virtualType === "completar" ? "completar" : "mcq";
      await db.insert(cuestionarioPreguntas).values({
        cuestionarioId: cuestionario.id,
        type: qType,
        question: q.question || "",
        options: q.options || [],
        correctIndex: q.correctIndex ?? 0,
        explanation: q.explanation || "",
        points: q.points || 1,
        orderIndex: i,
      } as any);
    }

    if (cursoId) {
      await notifyStudentsInCourse({
        cursoId,
        type: "study_material",
        title: `Nuevo cuestionario de estudio: ${title.trim()}`,
        message: `Se ha publicado un cuestionario con ${questions.length} preguntas para que estudies.`,
        excludeUserId: user.id,
        link: `/student/cuestionarios/${cuestionario.id}`,
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      cuestionarioId: cuestionario.id,
      mensaje: `Cuestionario "${title.trim()}" creado exitosamente con ${questions.length} preguntas.`,
    }, { status: 201 });
  } catch (error) {
    console.error("[teacher cuestionario create] error:", error);
    return NextResponse.json({ error: "Error al crear cuestionario" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "Solo docentes" }, { status: 403 });
  }

  try {
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
      })
      .from(cuestionarios)
      .innerJoin(subjects, eq(subjects.id, cuestionarios.subjectId))
      .leftJoin(cursos, eq(cursos.id, cuestionarios.cursoId))
      .where(eq(cuestionarios.teacherId, user.id))
      .orderBy(desc(cuestionarios.createdAt));

    const withCount = await Promise.all(
      list.map(async (c) => {
        const [countResult] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(cuestionarioPreguntas)
          .where(eq(cuestionarioPreguntas.cuestionarioId, c.id));
        return { ...c, preguntaCount: countResult?.count || 0 };
      })
    );

    return NextResponse.json({ cuestionarios: withCount });
  } catch (error) {
    console.error("[teacher cuestionarios] error:", error);
    return NextResponse.json({ error: "Error al cargar cuestionarios" }, { status: 500 });
  }
}
