import { NextRequest, NextResponse } from "next/server";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { asistencia } from "@/lib/db/schema";
import { sql, eq, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "Solo docentes" }, { status: 403 });
  }

  try {
    const { cursoId, fecha, registros } = await request.json();
    if (!cursoId || !fecha || !registros || !Array.isArray(registros)) {
      return NextResponse.json({ error: "Datos requeridos: cursoId, fecha, registros" }, { status: 400 });
    }

    for (const r of registros) {
      await db
        .insert(asistencia)
        .values({
          cursoId,
          studentId: r.studentId,
          fecha: new Date(fecha),
          estado: r.estado,
        })
        .onConflictDoUpdate({
          target: [asistencia.cursoId, asistencia.studentId, asistencia.fecha],
          set: { estado: r.estado },
        });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Attendance error:", error);
    return NextResponse.json({ error: "Error al registrar asistencia" }, { status: 500 });
  }
}
