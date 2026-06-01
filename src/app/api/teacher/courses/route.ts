import { NextRequest, NextResponse } from "next/server";

/**
 * @swagger
 * /api/teacher/courses:
 *   get:
 *     summary: Cursos del profesor
 *     description: Devuelve cursos asignados al profesor con sus materias asociadas.
 *     tags: [Profesor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de cursos del profesor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cursos:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       nombre: { type: string }
 *                       nivel: { type: string }
 *                       mySubjects:
 *                         type: array
 *                         items:
 *                           type: object
 *       403:
 *         description: Solo profesores
 */
import { db } from "@/lib/db";
import { cursos, cursoEstudiantes, cursoProfesores, users, subjects } from "@/lib/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { getTeacherCourseIds } from "@/lib/course-helpers";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const teacher = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!teacher || teacher.role !== "teacher") {
    return NextResponse.json({ error: "Solo profesores" }, { status: 403 });
  }

  try {
    const allIdsSet = await getTeacherCourseIds(teacher.id);
    const allIds = new Set(allIdsSet);

    if (allIds.size === 0) {
      return NextResponse.json({ cursos: [] });
    }

    const idsArray = [...allIds];

    const data = await db
      .select({
        id: cursos.id,
        nombre: cursos.nombre,
        nivel: cursos.nivel,
        profesorId: cursos.profesorId,
        profesorNombre: users.fullName,
        activo: cursos.activo,
        createdAt: cursos.createdAt,
        studentCount: sql<number>`count(DISTINCT ${cursoEstudiantes.estudianteId})`.mapWith(Number),
      })
      .from(cursos)
      .leftJoin(users, eq(cursos.profesorId, users.id))
      .leftJoin(cursoEstudiantes, eq(cursoEstudiantes.cursoId, cursos.id))
      .where(inArray(cursos.id, idsArray))
      .groupBy(cursos.id, users.fullName);

    const cursoIds = data.map(c => c.id);
    const allProfs = cursoIds.length > 0 ? await db
      .select({
        cursoId: cursoProfesores.cursoId,
        teacherId: cursoProfesores.teacherId,
        teacherName: users.fullName,
        subjectId: cursoProfesores.subjectId,
        subjectName: subjects.name,
        subjectEmoji: subjects.emoji,
      })
      .from(cursoProfesores)
      .innerJoin(users, eq(cursoProfesores.teacherId, users.id))
      .innerJoin(subjects, eq(cursoProfesores.subjectId, subjects.id))
      .where(inArray(cursoProfesores.cursoId, cursoIds)) : [];

    const profsByCurso = new Map<number, typeof allProfs>();
    for (const p of allProfs) {
      if (!profsByCurso.has(p.cursoId)) profsByCurso.set(p.cursoId, []);
      profsByCurso.get(p.cursoId)!.push(p);
    }

    const cursosWithTeachers = data.map(c => {
      const teacherSubjects = profsByCurso.get(c.id) || [];
      return {
        ...c,
        teacherSubjects,
        isTutor: c.profesorId === teacher.id,
        mySubjects: teacherSubjects.filter(ts => ts.teacherId === teacher.id),
      };
    });

    return NextResponse.json({ cursos: cursosWithTeachers });
  } catch (error) {
    console.error("Teacher courses error:", error);
    return NextResponse.json({ error: "Error al cargar cursos" }, { status: 500 });
  }
}
