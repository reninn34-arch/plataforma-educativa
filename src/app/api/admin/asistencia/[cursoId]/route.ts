import { NextRequest, NextResponse } from "next/server";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { asistencia, users, cursoEstudiantes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cursoId: string }> }
) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  try {
    const { cursoId } = await params;
    const fecha = request.nextUrl.searchParams.get("fecha") || new Date().toISOString().slice(0, 10);

    const attendanceData = await db
      .select({
        studentId: asistencia.studentId,
        studentName: users.fullName,
        cedula: users.cedula,
        estado: asistencia.estado,
        fecha: asistencia.fecha,
      })
      .from(asistencia)
      .innerJoin(users, eq(users.id, asistencia.studentId))
      .where(
        and(
          eq(asistencia.cursoId, parseInt(cursoId)),
          eq(asistencia.fecha, new Date(fecha))
        )
      )
      .orderBy(users.fullName);

    const enrolled = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        cedula: users.cedula,
      })
      .from(users)
      .innerJoin(cursoEstudiantes, eq(cursoEstudiantes.estudianteId, users.id))
      .where(
        and(
          eq(cursoEstudiantes.cursoId, parseInt(cursoId)),
          eq(users.activo, true)
        )
      )
      .orderBy(users.fullName);

    const attendanceMap = new Map(attendanceData.map((r) => [r.studentId, r.estado]));
    const allStudents = enrolled.map((s) => ({
      studentId: s.id,
      studentName: s.fullName,
      cedula: s.cedula,
      estado: attendanceMap.get(s.id) || "pendiente",
    }));

    return NextResponse.json({ fecha, asistencia: allStudents });
  } catch (error) {
    console.error("Admin attendance fetch error:", error);
    return NextResponse.json({ error: "Error al cargar asistencia" }, { status: 500 });
  }
}
