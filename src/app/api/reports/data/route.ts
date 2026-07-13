/**
 * @swagger
 * /api/reports/data:
 *   get:
 *     summary: Obtener datos de reporte de curso
 *     description: Genera un reporte detallado de un curso con estudiantes, promedios por materia, tareas entregadas y pendientes. Solo docentes y administradores.
 *     tags: [Analíticas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cursoId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del curso
 *     responses:
 *       200:
 *         description: Datos del reporte
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 curso:
 *                   type: object
 *                 subjects:
 *                   type: array
 *                 students:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       nombre:
 *                         type: string
 *                       promedioGeneral:
 *                         type: number
 *                       totalTareas:
 *                         type: integer
 *                       entregadas:
 *                         type: integer
 *                       pendientes:
 *                         type: integer
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalEstudiantes:
 *                       type: integer
 *                     promedioCurso:
 *                       type: number
 *                     totalTareas:
 *                       type: integer
 *                     totalMaterias:
 *                       type: integer
 *       400:
 *         description: cursoId es requerido
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Acción no permitida
 *       404:
 *         description: Curso no encontrado
 *       500:
 *         description: Error interno
 */
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { users, cursos, cursoEstudiantes, cursoProfesores, subjects, assignments, assignmentSubmissions } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || (user.role !== "admin" && user.role !== "teacher")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const url = new URL(request.url);
  const cursoId = url.searchParams.get("cursoId") ? Number(url.searchParams.get("cursoId")) : null;

  if (!cursoId) {
    return NextResponse.json({ error: "cursoId es requerido" }, { status: 400 });
  }

  try {
    const [curso] = await db
      .select({
        id: cursos.id,
        nombre: cursos.nombre,
        nivel: cursos.nivel,
        activo: cursos.activo,
      })
      .from(cursos)
      .where(eq(cursos.id, cursoId))
      .limit(1);

    if (!curso) {
      return NextResponse.json({ error: "Curso no encontrado" }, { status: 404 });
    }

    const enrolled = await db
      .select({ estudianteId: cursoEstudiantes.estudianteId })
      .from(cursoEstudiantes)
      .where(eq(cursoEstudiantes.cursoId, cursoId));

    const studentIds = enrolled.map(e => e.estudianteId);

    const courseSubjects = await db
      .select({
        subjectId: cursoProfesores.subjectId,
        subjectName: subjects.name,
        subjectEmoji: subjects.emoji,
        teacherId: cursoProfesores.teacherId,
        teacherName: users.fullName,
      })
      .from(cursoProfesores)
      .innerJoin(subjects, eq(cursoProfesores.subjectId, subjects.id))
      .innerJoin(users, eq(cursoProfesores.teacherId, users.id))
      .where(eq(cursoProfesores.cursoId, cursoId));

    const subjectIds = courseSubjects.map(s => s.subjectId);

    const allAssignments = subjectIds.length > 0 ? await db
      .select({
        id: assignments.id,
        subjectId: assignments.subjectId,
        title: assignments.title,
        puntos: assignments.puntos,
        trimester: assignments.trimester,
      })
      .from(assignments)
      .where(and(
        inArray(assignments.subjectId, subjectIds),
        eq(assignments.cursoId, cursoId),
      )) : [];

    const assignmentIds = allAssignments.map(a => a.id);

    const submissions = assignmentIds.length > 0 ? await db
      .select({
        studentId: assignmentSubmissions.studentId,
        grade: assignmentSubmissions.grade,
        assignmentId: assignmentSubmissions.assignmentId,
      })
      .from(assignmentSubmissions)
      .where(and(
        inArray(assignmentSubmissions.assignmentId, assignmentIds),
        inArray(assignmentSubmissions.studentId, studentIds),
      )) : [];

    const studentNames = studentIds.length > 0 ? await db
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(inArray(users.id, studentIds)) : [];

    const nameMap = new Map(studentNames.map(s => [s.id, s.fullName]));
    const assignmentMap = new Map(allAssignments.map(a => [a.id, a]));
    const subjectsMap = new Map(courseSubjects.map(s => [s.subjectId, s]));

    const students = studentIds.map(id => {
      const name = nameMap.get(id) || `Usuario #${id}`;
      const studentSubs = submissions.filter(s => s.studentId === id);

      const bySubject = new Map<number, { grades: number[]; maxPts: number[]; assignmentCount: number }>();
      for (const sub of studentSubs) {
        const a = assignmentMap.get(sub.assignmentId);
        if (!a) continue;
        if (!bySubject.has(a.subjectId)) {
          bySubject.set(a.subjectId, { grades: [], maxPts: [], assignmentCount: 0 });
        }
        const subjectData = bySubject.get(a.subjectId)!;
        subjectData.assignmentCount++;
        if (sub.grade !== null) {
          subjectData.grades.push(sub.grade);
          subjectData.maxPts.push(a.puntos || 10);
        }
      }

      const materias: { nombre: string; emoji: string; promedio: number; calificaciones: number }[] = [];
      let sumaTotal = 0;
      let totalGrades = 0;

      for (const [subId, data] of bySubject) {
        const subInfo = subjectsMap.get(subId);
        if (data.grades.length > 0) {
          const p = data.maxPts.reduce((a, b) => a + b, 0);
          const avg = p > 0 ? Math.round((data.grades.reduce((sum, g, i) => sum + g * data.maxPts[i], 0) / p) * 10) / 10 : 0;
          materias.push({
            nombre: subInfo?.subjectName || `Materia #${subId}`,
            emoji: subInfo?.subjectEmoji || "📚",
            promedio: avg,
            calificaciones: data.grades.length,
          });
          sumaTotal += avg;
          totalGrades++;
        }
      }

      const promedioGeneral = totalGrades > 0 ? Math.round((sumaTotal / totalGrades) * 10) / 10 : 0;
      const totalTareas = allAssignments.length;
      const entregadas = studentSubs.filter(s => s.grade !== null).length;

      return {
        id,
        nombre: name,
        promedioGeneral,
        totalTareas,
        entregadas,
        pendientes: totalTareas - entregadas,
        materias,
      };
    });

    students.sort((a, b) => b.promedioGeneral - a.promedioGeneral);

    const promedioCurso = students.length > 0
      ? Math.round((students.reduce((sum, s) => sum + s.promedioGeneral, 0) / students.length) * 10) / 10
      : 0;

    return NextResponse.json({
      curso: {
        id: curso.id,
        nombre: curso.nombre,
        nivel: curso.nivel,
      },
      subjects: courseSubjects.map(s => ({ id: s.subjectId, nombre: s.subjectName, emoji: s.subjectEmoji })),
      students,
      stats: {
        totalEstudiantes: students.length,
        promedioCurso,
        totalTareas: allAssignments.length,
        totalMaterias: courseSubjects.length,
      },
    });
  } catch (error) {
    console.error("Report data error:", error);
    return NextResponse.json({ error: "Error al generar reporte" }, { status: 500 });
  }
}
