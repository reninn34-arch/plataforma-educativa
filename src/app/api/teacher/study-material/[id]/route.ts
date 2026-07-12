/**
 * @swagger
 * /api/teacher/study-material/{id}:
 *   delete:
 *     summary: Eliminar material de estudio
 *     description: Elimina un material de estudio. Solo el autor (docente) puede eliminarlo.
 *     tags: [Material de Estudio]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del material
 *     responses:
 *       200:
 *         description: Material eliminado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo docentes o no es el autor
 *       404:
 *         description: Material no encontrado
 *       500:
 *         description: Error interno
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { studyMaterials } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = _request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(_request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "Solo docentes" }, { status: 403 });
  }

  try {
    const { id } = await params;

    const [material] = await db
      .select({ id: studyMaterials.id, teacherId: studyMaterials.teacherId })
      .from(studyMaterials)
      .where(eq(studyMaterials.id, Number(id)))
      .limit(1);

    if (!material) {
      return NextResponse.json({ error: "Material no encontrado" }, { status: 404 });
    }

    if (material.teacherId !== user.id) {
      return NextResponse.json({ error: "Solo el autor puede eliminar este material" }, { status: 403 });
    }

    await db.delete(studyMaterials).where(eq(studyMaterials.id, Number(id)));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[study-material] delete error:", error);
    return NextResponse.json({ error: "Error al eliminar material" }, { status: 500 });
  }
}
