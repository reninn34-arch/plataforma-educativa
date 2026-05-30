import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, cursoEstudiantes, cursoProfesores, cursos, progress, subjects, assignments, assignmentSubmissions, periodosLectivos } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { getTeacherCourseIds } from "@/lib/course-helpers";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const teacher = token ? await verifyToken(token) : null;
  if (!teacher || teacher.role !== "teacher") {
    return NextResponse.json({ error: "Solo profesores" }, { status: 403 });
  }

  try {
    const cursoIdParam = request.nextUrl.searchParams.get("cursoId");
    const search = request.nextUrl.searchParams.get("search") || "";

    const allIds = await getTeacherCourseIds(teacher.id);

    if (allIds.length === 0) {
      return NextResponse.json({ students: [] });
    }

    let targetCursoIds: number[];
    if (cursoIdParam) {
      const cid = parseInt(cursoIdParam);
      if (!allIds.includes(cid)) {
        return NextResponse.json({ error: "No tienes acceso a este curso" }, { status: 403 });
      }
      targetCursoIds = [cid];
    } else {
      targetCursoIds = allIds;
    }

    const studentRows = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        cedula: users.cedula,
        email: users.email,
        cursoId: cursoEstudiantes.cursoId,
        cursoNombre: cursos.nombre,
      })
      .from(users)
      .innerJoin(cursoEstudiantes, eq(cursoEstudiantes.estudianteId, users.id))
      .innerJoin(cursos, eq(cursos.id, cursoEstudiantes.cursoId))
      .where(and(
        inArray(cursoEstudiantes.cursoId, targetCursoIds),
        eq(users.activo, true),
        eq(users.role, "student" as any),
      ));

    const studentIds = [...new Set(studentRows.map(s => s.id))];

    const teacherSubjects = await db
      .select({ subjectId: cursoProfesores.subjectId })
      .from(cursoProfesores)
      .where(and(
        eq(cursoProfesores.teacherId, teacher.id),
        inArray(cursoProfesores.cursoId, targetCursoIds)
      ));
    const subjectIds = [...new Set(teacherSubjects.map(s => s.subjectId))];

    const progressData = studentIds.length > 0 && subjectIds.length > 0 ? await db
      .select({
        userId: progress.userId,
        subjectId: progress.subjectId,
        subjectName: subjects.name,
        subjectEmoji: subjects.emoji,
        percentage: progress.percentage,
        daysInactive: progress.daysInactive,
        consecutiveFailures: progress.consecutiveFailures,
        lastActivity: progress.lastActivity,
      })
      .from(progress)
      .innerJoin(subjects, eq(progress.subjectId, subjects.id))
      .where(and(
        inArray(progress.userId, studentIds),
        inArray(progress.subjectId, subjectIds),
      )) : [];

    const progressByStudent: Record<number, {
      subjectId: number; subjectName: string; subjectEmoji: string;
      percentage: number; daysInactive: number; consecutiveFailures: number; lastActivity: string | null;
    }[]> = {};

    for (const p of progressData) {
      if (!progressByStudent[p.userId]) progressByStudent[p.userId] = [];
      progressByStudent[p.userId].push({
        subjectId: p.subjectId,
        subjectName: p.subjectName,
        subjectEmoji: p.subjectEmoji,
        percentage: p.percentage,
        daysInactive: p.daysInactive,
        consecutiveFailures: p.consecutiveFailures,
        lastActivity: p.lastActivity ? new Date(p.lastActivity).toISOString() : null,
      });
    }

    const gradesData = studentIds.length > 0 && subjectIds.length > 0 ? await (async () => {
      const [activePeriod] = await db
        .select({ id: periodosLectivos.id })
        .from(periodosLectivos)
        .where(eq(periodosLectivos.activo, true))
        .limit(1);

      return db
        .select({
          studentId: assignmentSubmissions.studentId,
          grade: assignmentSubmissions.grade,
          status: assignmentSubmissions.status,
          submittedAt: assignmentSubmissions.submittedAt,
          assignmentId: assignmentSubmissions.assignmentId,
          puntos: assignments.puntos,
        })
        .from(assignmentSubmissions)
        .innerJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id))
        .where(and(
          eq(assignments.teacherId, teacher.id),
          inArray(assignmentSubmissions.studentId, studentIds),
          inArray(assignments.subjectId, subjectIds),
          ...(activePeriod ? [eq(assignments.periodoLectivoId, activePeriod.id)] : []),
        ));
    })() : [];

    const allAsignIds = [...new Set(gradesData.map(g => g.assignmentId))];
    const totalAssignments = allAsignIds.length;

    const gradesByStudent: Record<number, { average: number | null; pending: number; lastSubmission: string | null }> = {};

    for (const sid of studentIds) {
      gradesByStudent[sid] = { average: null, pending: totalAssignments, lastSubmission: null };
    }

    const studentGradesMap = new Map<number, { grades: number[]; puntos: number[] }>();
    for (const g of gradesData) {
      if (!studentGradesMap.has(g.studentId)) studentGradesMap.set(g.studentId, { grades: [], puntos: [] });
      if (g.grade !== null && g.grade !== undefined) {
        studentGradesMap.get(g.studentId)!.grades.push(g.grade);
        studentGradesMap.get(g.studentId)!.puntos.push(g.puntos || 10);
      }
    }

    const submittedByStudent: Record<number, Set<number>> = {};
    for (const g of gradesData) {
      if (!submittedByStudent[g.studentId]) submittedByStudent[g.studentId] = new Set();
      submittedByStudent[g.studentId].add(g.assignmentId);
    }

    for (const sid of studentIds) {
      const gr = studentGradesMap.get(sid) || { grades: [], puntos: [] };
      if (gr.grades.length > 0) {
        const totalPts = gr.puntos.reduce((a, b) => a + b, 0);
        const avg = gr.grades.reduce((sum, g, i) => sum + g * gr.puntos[i], 0) / totalPts;
        gradesByStudent[sid].average = Math.round(avg * 10) / 10;
      }
      gradesByStudent[sid].pending = totalAssignments > 0 ? totalAssignments - (submittedByStudent[sid]?.size || 0) : 0;
    }

    const lastSubs = gradesData.reduce((acc: Record<number, string>, g) => {
      if (g.submittedAt && (!acc[g.studentId] || new Date(g.submittedAt) > new Date(acc[g.studentId]))) {
        acc[g.studentId] = new Date(g.submittedAt).toISOString();
      }
      return acc;
    }, {});

    for (const sid of studentIds) {
      gradesByStudent[sid].lastSubmission = lastSubs[sid] || null;
    }

    const enriched = studentRows
      .filter(s => {
        if (!search) return true;
        const q = search.toLowerCase();
        return s.fullName.toLowerCase().includes(q) || s.cedula.includes(q);
      })
      .map(s => ({
        id: s.id,
        fullName: s.fullName,
        cedula: s.cedula,
        email: s.email,
        cursoId: s.cursoId,
        cursoNombre: s.cursoNombre,
        progress: progressByStudent[s.id] || [],
        grades: gradesByStudent[s.id] || { average: null, pending: 0, lastSubmission: null },
      }));

    return NextResponse.json({ students: enriched });
  } catch (error) {
    console.error("Teacher students error:", error);
    return NextResponse.json({ error: "Error al cargar estudiantes" }, { status: 500 });
  }
}
