/**
 * @swagger
 * /api/student/horario:
 *   get:
 *     summary: Horario del estudiante
 *     description: Devuelve el horario de clases del estudiante autenticado. Opcionalmente filtra por curso o solo el día de hoy.
 *     tags: [Estudiantes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cursoId
 *         schema:
 *           type: integer
 *         description: ID del curso para filtrar horario
 *       - in: query
 *         name: today
 *         schema:
 *           type: string
 *         description: Si es "true", filtra solo el horario del día actual
 *     responses:
 *       200:
 *         description: Horario del estudiante
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 horarios:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       dia: { type: string }
 *                       horaInicio: { type: string }
 *                       horaFin: { type: string }
 *                       subjectId: { type: integer, nullable: true }
 *                       subjectName: { type: string, nullable: true }
 *                       subjectEmoji: { type: string, nullable: true }
 *                       tipo: { type: string }
 *                       cursoId: { type: integer }
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { horarios, subjects, cursoEstudiantes } from "@/lib/db/schema";
import { eq, asc, inArray, sql, and, or, isNotNull } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
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
      .where(and(
        inArray(horarios.cursoId, cursoIds),
        or(
          isNotNull(horarios.subjectId),
          eq(horarios.tipo, "receso"),
        ),
      ))
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
