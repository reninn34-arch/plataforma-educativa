import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import postgres from "postgres";
import { getEnv } from "@/lib/env";

function getSql() {
  return postgres(getEnv().DATABASE_URL!);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cursoId: string }> }
) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "Solo docentes" }, { status: 403 });
  }

  try {
    const { cursoId } = await params;
    const fecha = request.nextUrl.searchParams.get("fecha") || new Date().toISOString().slice(0, 10);

    const sql = getSql();

    const data = await sql`
      SELECT a.student_id as "studentId", u.full_name as "studentName", u.cedula,
             a.estado, a.fecha
      FROM asistencia a
      JOIN users u ON u.id = a.student_id
      WHERE a.curso_id = ${parseInt(cursoId)} AND a.fecha = ${fecha}::date
      ORDER BY u.full_name
    `;

    const enrolled = await sql`
      SELECT u.id, u.full_name as "fullName", u.cedula
      FROM users u
      JOIN curso_estudiantes ce ON ce.estudiante_id = u.id
      WHERE ce.curso_id = ${parseInt(cursoId)} AND u.activo = true
      ORDER BY u.full_name
    `;

    await sql.end();

    const attendanceMap = new Map(data.map((r: any) => [r.studentId, r.estado]));
    const allStudents = enrolled.map((s: any) => ({
      studentId: s.id,
      studentName: s.fullName,
      cedula: s.cedula,
      estado: attendanceMap.get(s.id) || "pendiente",
    }));

    return NextResponse.json({ fecha, asistencia: allStudents });
  } catch (error) {
    console.error("Attendance fetch error:", error);
    return NextResponse.json({ error: "Error al cargar asistencia" }, { status: 500 });
  }
}
