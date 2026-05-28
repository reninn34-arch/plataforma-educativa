import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cursoEstudiantes, cursoProfesores, cursos, assignmentSubmissions, assignments, users } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const teacher = token ? await verifyToken(token) : null;
  if (!teacher || teacher.role !== "teacher") {
    return NextResponse.json({ error: "Solo profesores" }, { status: 403 });
  }

  try {
    const cursoIdParam = request.nextUrl.searchParams.get("cursoId");

    const mySubjectCourseIds = await db
      .select({ cursoId: cursoProfesores.cursoId })
      .from(cursoProfesores)
      .where(eq(cursoProfesores.teacherId, teacher.id));

    const tutorCourseIds = await db
      .select({ id: cursos.id })
      .from(cursos)
      .where(eq(cursos.profesorId, teacher.id));

    const allIds = [...new Set([
      ...mySubjectCourseIds.map(r => r.cursoId),
      ...tutorCourseIds.map(r => r.id),
    ])];

    if (allIds.length === 0) {
      return NextResponse.json({ totalEstudiantes: 0, pendientes: 0, bajoRendimiento: 0, promedioGeneral: 0, totalCursos: 0 });
    }

    let targetIds: number[];
    if (cursoIdParam) {
      const cid = parseInt(cursoIdParam);
      if (!allIds.includes(cid)) {
        return NextResponse.json({ error: "No tienes acceso a este curso" }, { status: 403 });
      }
      targetIds = [cid];
    } else {
      targetIds = allIds;
    }

    const teacherSubjects = await db
      .select({ subjectId: cursoProfesores.subjectId })
      .from(cursoProfesores)
      .where(and(
        eq(cursoProfesores.teacherId, teacher.id),
        inArray(cursoProfesores.cursoId, targetIds)
      ));
    const subjectIds = [...new Set(teacherSubjects.map(s => s.subjectId))];

    const enrolled = await db
      .select({ estudianteId: cursoEstudiantes.estudianteId })
      .from(cursoEstudiantes)
      .where(inArray(cursoEstudiantes.cursoId, targetIds));
    const uniqueIds = [...new Set(enrolled.map(r => r.estudianteId))];
    const totalEstudiantes = uniqueIds.length;

    if (totalEstudiantes === 0 || subjectIds.length === 0) {
      return NextResponse.json({
        totalEstudiantes, pendientes: 0, bajoRendimiento: 0, promedioGeneral: 0, totalCursos: targetIds.length,
      });
    }

    const grades = await db
      .select({
        studentId: assignmentSubmissions.studentId,
        grade: assignmentSubmissions.grade,
        status: assignmentSubmissions.status,
      })
      .from(assignmentSubmissions)
      .innerJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id))
      .where(and(
        eq(assignments.teacherId, teacher.id),
        inArray(assignmentSubmissions.studentId, uniqueIds),
        inArray(assignments.subjectId, subjectIds),
      ));

    const studentData = new Map<number, { grades: number[]; pending: number }>();

    for (const s of uniqueIds) {
      studentData.set(s, { grades: [], pending: 0 });
    }

    for (const g of grades) {
      const sd = studentData.get(g.studentId);
      if (!sd) continue;
      if (g.grade !== null && g.grade !== undefined) {
        sd.grades.push(g.grade);
      }
    }

    // Count pending assignments per student
    const allAssignments = await db
      .select({ id: assignments.id })
      .from(assignments)
      .where(and(
        eq(assignments.teacherId, teacher.id),
        inArray(assignments.subjectId, subjectIds),
        inArray(assignments.cursoId, targetIds),
      ));
    const assignmentIds = allAssignments.map(a => a.id);

    if (assignmentIds.length > 0) {
      const submissions = await db
        .select({ studentId: assignmentSubmissions.studentId })
        .from(assignmentSubmissions)
        .where(and(
          inArray(assignmentSubmissions.assignmentId, assignmentIds),
          inArray(assignmentSubmissions.studentId, uniqueIds),
        ));

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
    let pendientes = 0;
    let bajoRendimiento = 0;

    for (const [_, sd] of studentData) {
      if (sd.grades.length > 0) {
        const avg = sd.grades.reduce((a, b) => a + b, 0) / sd.grades.length;
        avgs.push(avg);
        if (avg < 7) bajoRendimiento++;
      }
      if (sd.pending > 0) pendientes++;
    }

    const promedioGeneral = avgs.length > 0
      ? Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 10)
      : 0;

    return NextResponse.json({
      totalEstudiantes,
      pendientes,
      bajoRendimiento,
      promedioGeneral,
      totalCursos: targetIds.length,
    });
  } catch (error) {
    console.error("Academic stats error:", error);
    return NextResponse.json({ error: "Error al cargar estadisticas" }, { status: 500 });
  }
}
