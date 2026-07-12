/**
 * @swagger
 * /api/admin/subjects/{id}:
 *   put:
 *     summary: Actualizar materia
 *     description: Actualiza el nombre, emoji, color o slug de una materia existente.
 *     tags: [Administración]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la materia
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               emoji: { type: string }
 *               color: { type: string }
 *               slug: { type: string }
 *     responses:
 *       200:
 *         description: Materia actualizada
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       404:
 *         description: Materia no encontrada
 *       409:
 *         description: Conflicto con otra materia
 *       500:
 *         description: Error interno
 *   delete:
 *     summary: Eliminar materia
 *     description: Elimina una materia si no está siendo usada en otros registros.
 *     tags: [Administración]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la materia
 *     responses:
 *       200:
 *         description: Materia eliminada
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       404:
 *         description: Materia no encontrada
 *       409:
 *         description: Materia en uso
 *       500:
 *         description: Error interno
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subjects, progress, modules, chatSessions, assignments, practiceSessions, practiceAnswers, cursoProfesores, studyMaterials, cuestionarios, horarios } from "@/lib/db/schema";
import { eq, or, sql } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const referenceTables = [
  { table: progress, label: "progreso de estudiantes" },
  { table: modules, label: "módulos de estudio" },
  { table: chatSessions, label: "sesiones de chat" },
  { table: assignments, label: "tareas" },
  { table: practiceSessions, label: "sesiones de práctica" },
  { table: practiceAnswers, label: "respuestas de práctica" },
  { table: cursoProfesores, label: "cursos" },
  { table: studyMaterials, label: "materiales de estudio" },
  { table: cuestionarios, label: "cuestionarios" },
  { table: horarios, label: "horarios" },
];

async function isSubjectInUse(subjectId: number): Promise<string | null> {
  for (const ref of referenceTables) {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(ref.table)
      .where(eq(ref.table.subjectId, subjectId))
      .limit(1);
    if (row.count > 0) {
      return ref.label;
    }
  }
  return null;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const admin = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!admin || admin.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  try {
    const { id } = await params;
    const subjectId = parseInt(id);
    const body = await request.json();

    const [existing] = await db.select().from(subjects).where(eq(subjects.id, subjectId)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Materia no encontrada" }, { status: 404 });
    }

    const name = body.name?.trim() || existing.name;
    const emoji = body.emoji?.trim() || existing.emoji;
    const color = body.color?.trim() || existing.color;
    const slug = body.slug?.trim() || slugify(name);

    if (body.name && body.name.trim()) {
      const [dup] = await db
        .select({ id: subjects.id })
        .from(subjects)
        .where(or(eq(subjects.name, name), eq(subjects.slug, slug)))
        .limit(1);
      if (dup && dup.id !== subjectId) {
        return NextResponse.json({ error: "Ya existe otra materia con ese nombre o slug" }, { status: 409 });
      }
    }

    await db
      .update(subjects)
      .set({ name, emoji, color, slug })
      .where(eq(subjects.id, subjectId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/admin/subjects error:", error);
    return NextResponse.json({ error: "Error al actualizar materia" }, { status: 500 });
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
    const subjectId = parseInt(id);

    const [existing] = await db.select().from(subjects).where(eq(subjects.id, subjectId)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Materia no encontrada" }, { status: 404 });
    }

    const inUse = await isSubjectInUse(subjectId);
    if (inUse) {
      return NextResponse.json({
        error: `No se puede eliminar "${existing.name}" porque está siendo usada en ${inUse}. Reasigna esos registros primero.`,
      }, { status: 409 });
    }

    await db.delete(subjects).where(eq(subjects.id, subjectId));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/subjects error:", error);
    return NextResponse.json({ error: "Error al eliminar materia" }, { status: 500 });
  }
}
