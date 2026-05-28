import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, cursoEstudiantes, cursoProfesores, cursos, progress } from "@/lib/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
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
      return NextResponse.json({ totalEstudiantes: 0, enRiesgo: 0, inactivos: 0, promedio: 0, totalCursos: 0 });
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

    const studentIds = await db
      .select({ estudianteId: cursoEstudiantes.estudianteId })
      .from(cursoEstudiantes)
      .where(inArray(cursoEstudiantes.cursoId, targetIds));

    const uniqueStudentIds = [...new Set(studentIds.map(r => r.estudianteId))];
    const totalEstudiantes = uniqueStudentIds.length;

    if (totalEstudiantes === 0) {
      return NextResponse.json({
        totalEstudiantes: 0,
        enRiesgo: 0,
        inactivos: 0,
        promedio: 0,
        totalCursos: targetIds.length,
      });
    }

    const risikoData = await db
      .select({
        userId: progress.userId,
        daysInactive: progress.daysInactive,
        consecutiveFailures: progress.consecutiveFailures,
        percentage: progress.percentage,
      })
      .from(progress)
      .where(inArray(progress.userId, uniqueStudentIds));

    const enRiesgoSet = new Set<number>();
    const inactivosSet = new Set<number>();
    const studentProgressMap = new Map<number, number[]>();

    for (const r of risikoData) {
      if (r.consecutiveFailures >= 3 || r.daysInactive >= 7) {
        enRiesgoSet.add(r.userId);
      }
      if (r.daysInactive >= 14) {
        inactivosSet.add(r.userId);
      }
      if (!studentProgressMap.has(r.userId)) {
        studentProgressMap.set(r.userId, []);
      }
      studentProgressMap.get(r.userId)!.push(r.percentage);
    }

    const enRiesgo = enRiesgoSet.size;
    const inactivos = inactivosSet.size;

    const studentAvgs = Array.from(studentProgressMap.values())
      .map(grades => grades.reduce((a, b) => a + b, 0) / grades.length);

    const promedio = studentAvgs.length > 0
      ? Math.round(studentAvgs.reduce((a, b) => a + b, 0) / studentAvgs.length)
      : 0;

    return NextResponse.json({
      totalEstudiantes,
      enRiesgo,
      inactivos,
      promedio,
      totalCursos: targetIds.length,
    });
  } catch (error) {
    console.error("Teacher stats error:", error);
    return NextResponse.json({ error: "Error al cargar estadisticas" }, { status: 500 });
  }
}
