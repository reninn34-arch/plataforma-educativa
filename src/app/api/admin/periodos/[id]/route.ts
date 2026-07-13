/**
 * @swagger
 * /api/admin/periodos/{id}:
 *   put:
 *     summary: Actualizar período lectivo
 *     description: Actualiza el nombre, fechas o estado activo de un período lectivo. Si se activa, desactiva los demás.
 *     tags: [Administración]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del período lectivo
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre: { type: string }
 *               fechaInicio: { type: string, format: date }
 *               fechaFin: { type: string, format: date }
 *               activo: { type: boolean }
 *     responses:
 *       200:
 *         description: Período actualizado
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       500:
 *         description: Error interno
 *   delete:
 *     summary: Eliminar período lectivo
 *     description: Elimina un período lectivo si no tiene tareas asociadas.
 *     tags: [Administración]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del período lectivo
 *     responses:
 *       200:
 *         description: Período eliminado
 *       400:
 *         description: No se puede eliminar porque tiene tareas asignadas
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       500:
 *         description: Error interno
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { periodosLectivos, assignments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  try {
    const { id } = await params;
    const periodoId = parseInt(id);
    const { nombre, fechaInicio, fechaFin, activo } = await request.json();

    if (activo === true) {
      await db.update(periodosLectivos).set({ activo: false }).where(eq(periodosLectivos.activo, true));
    }

    const updateData: Record<string, unknown> = {};
    if (nombre) updateData.nombre = nombre;
    if (fechaInicio !== undefined) updateData.fechaInicio = fechaInicio ? new Date(fechaInicio) : null;
    if (fechaFin !== undefined) updateData.fechaFin = fechaFin ? new Date(fechaFin) : null;
    if (activo !== undefined) updateData.activo = activo;

    await db.update(periodosLectivos).set(updateData).where(eq(periodosLectivos.id, periodoId));
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  try {
    const { id } = await params;
    const periodoId = parseInt(id);

    const refs = await db
      .select({ id: assignments.id })
      .from(assignments)
      .where(eq(assignments.periodoLectivoId, periodoId))
      .limit(1);

    if (refs.length > 0) {
      return NextResponse.json({ error: "No se puede eliminar. Hay tareas asignadas a este periodo." }, { status: 400 });
    }

    await db.delete(periodosLectivos).where(eq(periodosLectivos.id, periodoId));
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
