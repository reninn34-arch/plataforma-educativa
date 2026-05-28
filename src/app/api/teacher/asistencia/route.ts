import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import postgres from "postgres";
import { getEnv } from "@/lib/env";

function getSql() {
  return postgres(getEnv().DATABASE_URL!);
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "Solo docentes" }, { status: 403 });
  }

  try {
    const { cursoId, fecha, registros } = await request.json();
    if (!cursoId || !fecha || !registros || !Array.isArray(registros)) {
      return NextResponse.json({ error: "Datos requeridos: cursoId, fecha, registros" }, { status: 400 });
    }

    const sql = getSql();
    for (const r of registros) {
      await sql`
        INSERT INTO asistencia (curso_id, student_id, fecha, estado)
        VALUES (${cursoId}, ${r.studentId}, ${fecha}::date, ${r.estado})
        ON CONFLICT (curso_id, student_id, fecha) DO UPDATE SET estado = ${r.estado}
      `;
    }
    await sql.end();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Attendance error:", error);
    return NextResponse.json({ error: "Error al registrar asistencia" }, { status: 500 });
  }
}
