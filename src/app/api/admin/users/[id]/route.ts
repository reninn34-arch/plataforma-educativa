/**
 * @swagger
 * /api/admin/users/{id}:
 *   put:
 *     summary: Actualizar usuario
 *     description: Actualiza los datos de un usuario (nombre, email, whatsapp, cédula, activo) o reinicia su PIN.
 *     tags: [Administración]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               activo: { type: boolean }
 *               fullName: { type: string }
 *               email: { type: string, nullable: true }
 *               whatsapp: { type: string, nullable: true }
 *               cedula: { type: string, description: "10 dígitos" }
 *               resetPin: { type: boolean, description: "Si es true, genera un nuevo PIN" }
 *     responses:
 *       200:
 *         description: Usuario actualizado
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       500:
 *         description: Error interno
 *   delete:
 *     summary: Desactivar usuario
 *     description: Desactiva (soft delete) un usuario sin eliminarlo permanentemente.
 *     tags: [Administración]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Usuario desactivado
 *       400:
 *         description: No puedes eliminar tu propia cuenta
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       500:
 *         description: Error interno
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, sql, type InferInsertModel } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { hashPin } from "@/lib/hash-utils";
import { isValidPin } from "@/lib/api-helpers";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const admin = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!admin || admin.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  try {
    const { id } = await params;
    const userId = parseInt(id);
    const body = await request.json();

    const updateData: Partial<InferInsertModel<typeof users>> = {};

    if (body.activo !== undefined) {
      updateData.activo = body.activo;
    }

    if (body.fullName) {
      updateData.fullName = body.fullName;
    }

    if (body.email !== undefined) {
      updateData.email = body.email || null;
    }

    if (body.whatsapp !== undefined) {
      updateData.whatsapp = body.whatsapp || null;
    }

    if (body.cedula && body.cedula.length === 10) {
      const [dup] = await db.select({ id: users.id }).from(users).where(eq(users.cedula, body.cedula)).limit(1);
      if (dup && dup.id !== userId) {
        return NextResponse.json({ error: "Esa cedula ya pertenece a otro usuario" }, { status: 400 });
      }
      updateData.cedula = body.cedula;
    }

    if (body.resetPin) {
      const pin = String(Math.floor(1000 + Math.random() * 9000));
      updateData.pin = await hashPin(pin);
      updateData.pinUpdatedAt = sql`now()` as any;
      await db.update(users).set(updateData).where(eq(users.id, userId));
      return NextResponse.json({ success: true, updated: true, newPin: pin });
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    }

    await db.update(users).set(updateData).where(eq(users.id, userId));
    return NextResponse.json({ success: true, updated: true });
  } catch {
    return NextResponse.json({ error: "Error al actualizar usuario" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const admin = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!admin || admin.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  try {
    const { id } = await params;
    const userId = parseInt(id);

    if (userId === admin.id) {
      return NextResponse.json({ error: "No puedes eliminar tu propia cuenta" }, { status: 400 });
    }

    await db.update(users).set({ activo: false }).where(eq(users.id, userId));
    return NextResponse.json({ success: true, desactivado: true });
  } catch {
    return NextResponse.json({ error: "Error al desactivar usuario" }, { status: 500 });
  }
}
