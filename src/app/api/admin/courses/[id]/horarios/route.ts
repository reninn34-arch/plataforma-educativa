import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { horarios, subjects } from "@/lib/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  try {
    const { id } = await params;
    const cursoId = parseInt(id);

    const data = await db
      .select({
        id: horarios.id,
        dia: horarios.dia,
        horaInicio: horarios.horaInicio,
        horaFin: horarios.horaFin,
        subjectId: horarios.subjectId,
        subjectName: subjects.name,
        subjectEmoji: subjects.emoji,
        tipo: horarios.tipo,
      })
      .from(horarios)
      .leftJoin(subjects, eq(horarios.subjectId, subjects.id))
      .where(eq(horarios.cursoId, cursoId))
      .orderBy(
        sql`CASE ${horarios.dia}
          WHEN 'lunes' THEN 1
          WHEN 'martes' THEN 2
          WHEN 'miercoles' THEN 3
          WHEN 'jueves' THEN 4
          WHEN 'viernes' THEN 5
          ELSE 6 END`,
        asc(horarios.horaInicio)
      );

    return NextResponse.json({ horarios: data });
  } catch (error) {
    return NextResponse.json({ error: "Error al cargar horario" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  try {
    const { id } = await params;
    const cursoId = parseInt(id);
    const { bloques } = await request.json();

    if (!Array.isArray(bloques)) {
      return NextResponse.json({ error: "bloques debe ser un array" }, { status: 400 });
    }

    await db.delete(horarios).where(eq(horarios.cursoId, cursoId));

    if (bloques.length > 0) {
      await db.insert(horarios).values(
        bloques.map((b: any) => ({
          cursoId,
          dia: b.dia,
          horaInicio: b.horaInicio,
          horaFin: b.horaFin,
          subjectId: b.subjectId || null,
          tipo: b.tipo || "clase",
        }))
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Error al guardar horario" }, { status: 500 });
  }
}
