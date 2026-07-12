/**
 * @swagger
 * /api/admin/courses/{id}/horarios:
 *   get:
 *     summary: Obtener horario del curso
 *     description: Devuelve los bloques horarios del curso ordenados por día y hora.
 *     tags: [Administración]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del curso
 *     responses:
 *       200:
 *         description: Horario del curso
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       500:
 *         description: Error interno
 *   put:
 *     summary: Guardar horario del curso
 *     description: Reemplaza completamente el horario del curso con los bloques enviados.
 *     tags: [Administración]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del curso
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bloques]
 *             properties:
 *               bloques:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     dia: { type: string, enum: [lunes, martes, miercoles, jueves, viernes] }
 *                     horaInicio: { type: string }
 *                     horaFin: { type: string }
 *                     subjectId: { type: integer, nullable: true }
 *                     tipo: { type: string, default: "clase" }
 *     responses:
 *       200:
 *         description: Horario guardado
 *       400:
 *         description: bloques debe ser un array
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       500:
 *         description: Error interno
 */
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
