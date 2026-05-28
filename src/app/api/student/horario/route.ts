import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { horarios, subjects, cursoEstudiantes } from "@/lib/db/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user || user.role !== "student") return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const cursoIdParam = request.nextUrl.searchParams.get("cursoId");
    const today = request.nextUrl.searchParams.get("today") === "true";

    let cursoIds: number[];
    if (cursoIdParam) {
      cursoIds = [parseInt(cursoIdParam)];
    } else {
      const enrolled = await db
        .select({ cursoId: cursoEstudiantes.cursoId })
        .from(cursoEstudiantes)
        .where(eq(cursoEstudiantes.estudianteId, user.id));
      cursoIds = enrolled.map(e => e.cursoId);
    }

    if (cursoIds.length === 0) {
      return NextResponse.json({ horarios: [] });
    }

    let query = db
      .select({
        id: horarios.id,
        dia: horarios.dia,
        horaInicio: horarios.horaInicio,
        horaFin: horarios.horaFin,
        subjectId: horarios.subjectId,
        subjectName: subjects.name,
        subjectEmoji: subjects.emoji,
        tipo: horarios.tipo,
        cursoId: horarios.cursoId,
      })
      .from(horarios)
      .leftJoin(subjects, eq(horarios.subjectId, subjects.id))
      .where(inArray(horarios.cursoId, cursoIds))
      .orderBy(asc(horarios.horaInicio));

    const data = await query;

    if (today) {
      const dias = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
      const hoy = dias[new Date().getDay()];
      return NextResponse.json({ horarios: data.filter(h => h.dia === hoy) });
    }

    return NextResponse.json({ horarios: data });
  } catch (error) {
    return NextResponse.json({ error: "Error al cargar horario" }, { status: 500 });
  }
}
