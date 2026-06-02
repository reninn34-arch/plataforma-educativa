/**
 * @swagger
 * /api/teacher/asistencia:
 *   post:
 *     summary: Registrar asistencia
 *     description: Registra o actualiza la asistencia de estudiantes en un curso para una fecha específica.
 *     tags: [Profesor]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cursoId, fecha, registros]
 *             properties:
 *               cursoId: { type: integer, description: "ID del curso" }
 *               fecha: { type: string, format: date, description: "Fecha de asistencia (YYYY-MM-DD)" }
 *               registros:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     studentId: { type: integer }
 *                     estado:
 *                       type: string
 *                       enum: [presente, ausente, tardanza, justificado]
 *     responses:
 *       200:
 *         description: Asistencia guardada
 *       400:
 *         description: Datos inválidos
 *       403:
 *         description: Solo profesores
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { asistencia } from "@/lib/db/schema";

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

    const date = new Date(fecha);

    for (const r of registros) {
      await db
        .insert(asistencia)
        .values({ cursoId, studentId: r.studentId, fecha: date, estado: r.estado })
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
