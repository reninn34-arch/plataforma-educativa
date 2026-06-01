import { NextRequest, NextResponse } from "next/server";

/**
 * @swagger
 * /api/dashboard/teacher:
 *   get:
 *     summary: Dashboard del profesor
 *     description: Devuelve perfil, cursos asignados, estadísticas de sesiones y tareas pendientes.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Datos del dashboard del profesor
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No es profesor
 */
import { db } from "@/lib/db";
import { users, cursos, cursoEstudiantes, cursoProfesores, subjects, periodosLectivos, assignmentSubmissions, assignments } from "@/lib/db/schema";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { getTeacherCourseIds } from "@/lib/course-helpers";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const teacher = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!teacher || teacher.role !== "teacher") {
    return NextResponse.json({ error: "Solo docentes" }, { status: 403 });
  }

  try {
    const [profileRow] = await db
      .select({ id: users.id, fullName: users.fullName, cedula: users.cedula, role: users.role, email: users.email })
      .from(users)
      .where(eq(users.id, teacher.id))
      .limit(1);

    const allIdsSet = await getTeacherCourseIds(teacher.id);
    if (allIdsSet.length === 0) {
      return NextResponse.json({ profile: profileRow, courses: [], periods: [], activePeriod: null, stats: { totalEstudiantes: 0, pendientes: 0, bajoRendimiento: 0, promedioGeneral: 0, totalCursos: 0 } });
    }

    const coursesData = await db
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
      .where(inArray(cursos.id, allIdsSet))
      .groupBy(cursos.id, users.fullName);

    const cursoIds = coursesData.map(c => c.id);
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

    const courses = coursesData.map(c => ({
      id: c.id, nombre: c.nombre, nivel: c.nivel, profesorId: c.profesorId, profesorNombre: c.profesorNombre,
      activo: c.activo, createdAt: c.createdAt, studentCount: c.studentCount,
      teacherSubjects: profsByCurso.get(c.id) || [],
      isTutor: c.profesorId === teacher.id,
      mySubjects: (profsByCurso.get(c.id) || []).filter((ts: any) => ts.teacherId === teacher.id),
    }));

    const allPeriods = await db.select().from(periodosLectivos).orderBy(desc(periodosLectivos.createdAt));
    const [activePeriod] = await db.select().from(periodosLectivos).where(eq(periodosLectivos.activo, true)).limit(1);

    const teacherSubjects = await db
      .select({ subjectId: cursoProfesores.subjectId })
      .from(cursoProfesores)
      .where(and(eq(cursoProfesores.teacherId, teacher.id), inArray(cursoProfesores.cursoId, allIdsSet)));
    const subjectIds = [...new Set(teacherSubjects.map(s => s.subjectId))];

    const enrolled = await db
      .select({ estudianteId: cursoEstudiantes.estudianteId })
      .from(cursoEstudiantes)
      .where(inArray(cursoEstudiantes.cursoId, allIdsSet));
    const uniqueIds = [...new Set(enrolled.map(r => r.estudianteId))];
    const totalEstudiantes = uniqueIds.length;

    let pendientes = 0, bajoRendimiento = 0, promedioGeneral = 0;

    if (totalEstudiantes > 0 && subjectIds.length > 0) {
      const [activePeriodData] = activePeriod
        ? await db.select({ id: periodosLectivos.id }).from(periodosLectivos).where(eq(periodosLectivos.activo, true)).limit(1)
        : [null];

      const grades = await db
        .select({ studentId: assignmentSubmissions.studentId, grade: assignmentSubmissions.grade, puntos: assignments.puntos })
        .from(assignmentSubmissions)
        .innerJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id))
        .where(and(
          eq(assignments.teacherId, teacher.id),
          inArray(assignmentSubmissions.studentId, uniqueIds),
          inArray(assignments.subjectId, subjectIds),
          ...(activePeriodData ? [eq(assignments.periodoLectivoId, activePeriodData.id)] : []),
        ));

      const studentData = new Map<number, { grades: number[]; puntosArr: number[]; pending: number }>();
      for (const s of uniqueIds) studentData.set(s, { grades: [], puntosArr: [], pending: 0 });
      for (const g of grades) {
        const sd = studentData.get(g.studentId);
        if (!sd) continue;
        if (g.grade !== null && g.grade !== undefined) {
          sd.grades.push(g.grade);
          sd.puntosArr.push(g.puntos || 10);
        }
      }

      const allAssignments = await db
        .select({ id: assignments.id })
        .from(assignments)
        .where(and(eq(assignments.teacherId, teacher.id), inArray(assignments.subjectId, subjectIds), inArray(assignments.cursoId, allIdsSet)));
      const assignmentIds = allAssignments.map(a => a.id);

      if (assignmentIds.length > 0) {
        const submissions = await db
          .select({ studentId: assignmentSubmissions.studentId })
          .from(assignmentSubmissions)
          .where(and(inArray(assignmentSubmissions.assignmentId, assignmentIds), inArray(assignmentSubmissions.studentId, uniqueIds)));
        const submittedSet = new Map<number, Set<number>>();
        for (const s of submissions) {
          if (!submittedSet.has(s.studentId)) submittedSet.set(s.studentId, new Set());
          submittedSet.get(s.studentId)!.add(s.studentId);
        }
        for (const s of uniqueIds) {
          const sd = studentData.get(s)!;
          sd.pending = assignmentIds.length - (submittedSet.get(s)?.size || 0);
        }
      }

      const avgs: number[] = [];
      for (const [_, sd] of studentData) {
        if (sd.grades.length > 0) {
          const totalPts = sd.puntosArr.reduce((a, b) => a + b, 0);
          const avg = sd.grades.reduce((sum, g, i) => sum + g * sd.puntosArr[i], 0) / totalPts;
          avgs.push(avg);
          if (avg < 7) bajoRendimiento++;
        }
        if (sd.pending > 0) pendientes++;
      }
      promedioGeneral = avgs.length > 0 ? Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 10) : 0;
    }

    return NextResponse.json({
      profile: profileRow,
      courses,
      periods: allPeriods,
      activePeriod: activePeriod || null,
      stats: { totalEstudiantes, pendientes, bajoRendimiento, promedioGeneral, totalCursos: allIdsSet.length },
    });
  } catch (error) {
    console.error("Teacher dashboard error:", error);
    return NextResponse.json({ error: "Error al cargar dashboard" }, { status: 500 });
  }
}