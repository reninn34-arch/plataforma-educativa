/**
 * @swagger
 * /api/teacher/horario:
 *   get:
 *     summary: Obtener horario del docente
 *     description: Devuelve el horario de clases del docente, opcionalmente filtrado por curso.
 *     tags: [Docentes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cursoId
 *         schema:
 *           type: integer
 *         description: ID del curso para filtrar (opcional)
 *     responses:
 *       200:
 *         description: Horario del docente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 horarios:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       dia: { type: string }
 *                       horaInicio: { type: string }
 *                       horaFin: { type: string }
 *                       subjectId: { type: integer }
 *                       subjectName: { type: string }
 *                       subjectEmoji: { type: string }
 *                       tipo: { type: string }
 *                       cursoId: { type: integer }
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo docentes
 *       500:
 *         description: Error interno
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { horarios, subjects, cursoProfesores } from "@/lib/db/schema";
import { eq, and, inArray, asc, sql } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { getTeacherCourseIds } from "@/lib/course-helpers";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const teacher = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!teacher || teacher.role !== "teacher") {
    return NextResponse.json({ error: "Solo docentes" }, { status: 403 });
  }

  try {
    const cursoIdParam = request.nextUrl.searchParams.get("cursoId");

    const teacherCourseIds = await getTeacherCourseIds(teacher.id);

    const myCourses = await db
      .select({ cursoId: cursoProfesores.cursoId, subjectId: cursoProfesores.subjectId })
      .from(cursoProfesores)
      .where(eq(cursoProfesores.teacherId, teacher.id));

    const mySubjectIds = [...new Set(myCourses.map(r => r.subjectId))];
    let targetCursoIds = teacherCourseIds;

    if (cursoIdParam) {
      const cid = parseInt(cursoIdParam);
      if (!targetCursoIds.includes(cid)) {
        return NextResponse.json({ horarios: [] });
      }
      targetCursoIds = [cid];
    }

    if (targetCursoIds.length === 0 || mySubjectIds.length === 0) {
      return NextResponse.json({ horarios: [] });
    }

    const data = await db
      .select({
        id: horarios.id,
        dia: horarios.dia,
        horaInicio: horarios.horaInicio,
        horaFin: horarios.horaFin,
        subjectId: horarios.subjectId,
        subjectName: subjects.name,
        subjectEmoji: subjects.emoji,
        tipo: horarios.tipo,
        cursoId: horarios.cursoId,
      })
      .from(horarios)
      .leftJoin(subjects, eq(horarios.subjectId, subjects.id))
      .where(and(
        inArray(horarios.cursoId, targetCursoIds),
        inArray(horarios.subjectId, mySubjectIds),
      ))
      .orderBy(
        sql`CASE ${horarios.dia}
          WHEN 'lunes' THEN 1
          WHEN 'martes' THEN 2
          WHEN 'miercoles' THEN 3
          WHEN 'jueves' THEN 4
          WHEN 'viernes' THEN 5
          ELSE 6 END`,
        asc(horarios.horaInicio)
      );

    return NextResponse.json({ horarios: data });
  } catch {
    return NextResponse.json({ error: "Error al cargar horario" }, { status: 500 });
  }
}
