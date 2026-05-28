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
        daysInactive: progress.daysInactive,
        consecutiveFailures: progress.consecutiveFailures,
        percentage: progress.percentage,
      })
      .from(progress)
      .where(inArray(progress.userId, uniqueStudentIds));

    const enRiesgo = risikoData.filter(p => p.consecutiveFailures >= 3 || p.daysInactive >= 7).length;
    const inactivos = risikoData.filter(p => p.daysInactive >= 14).length;
    const promedio = risikoData.length > 0
      ? Math.round(risikoData.reduce((sum, p) => sum + p.percentage, 0) / risikoData.length)
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
