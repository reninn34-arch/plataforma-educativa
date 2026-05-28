import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, cursoEstudiantes, cursoProfesores, cursos, progress, subjects } from "@/lib/db/schema";
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
    const search = request.nextUrl.searchParams.get("search") || "";

    const mySubjectCourses = await db
      .select({ cursoId: cursoProfesores.cursoId })
      .from(cursoProfesores)
      .where(eq(cursoProfesores.teacherId, teacher.id));

    const tutorCourses = await db
      .select({ id: cursos.id })
      .from(cursos)
      .where(eq(cursos.profesorId, teacher.id));

    const allIds = [...new Set([
      ...mySubjectCourses.map(r => r.cursoId),
      ...tutorCourses.map(r => r.id),
    ])];

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
      }));

    return NextResponse.json({ students: enriched });
  } catch (error) {
    console.error("Teacher students error:", error);
    return NextResponse.json({ error: "Error al cargar estudiantes" }, { status: 500 });
  }
}
