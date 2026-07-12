/**
 * @swagger
 * /api/admin/courses/{id}/students:
 *   get:
 *     summary: Listar estudiantes de un curso
 *     description: Devuelve la lista de estudiantes inscritos en un curso.
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
 *         description: Lista de estudiantes
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       500:
 *         description: Error interno
 *   post:
 *     summary: Agregar estudiante al curso
 *     description: Inscribe un estudiante en el curso especificado.
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
 *             required: [estudianteId]
 *             properties:
 *               estudianteId: { type: integer }
 *     responses:
 *       201:
 *         description: Estudiante agregado
 *       400:
 *         description: El estudiante ya está en el curso
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       500:
 *         description: Error interno
 *   delete:
 *     summary: Remover estudiante del curso
 *     description: Elimina la inscripción de un estudiante del curso.
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
 *             required: [estudianteId]
 *             properties:
 *               estudianteId: { type: integer }
 *     responses:
 *       200:
 *         description: Estudiante removido
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       500:
 *         description: Error interno
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cursoEstudiantes, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
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
        id: cursoEstudiantes.id,
        estudianteId: users.id,
        cedula: users.cedula,
        fullName: users.fullName,
        email: users.email,
      })
      .from(cursoEstudiantes)
      .leftJoin(users, eq(cursoEstudiantes.estudianteId, users.id))
      .where(eq(cursoEstudiantes.cursoId, cursoId))
      .orderBy(users.fullName);

    return NextResponse.json({ students: data });
  } catch (error) {
    console.error("Course students error:", error);
    return NextResponse.json({ error: "Error al cargar estudiantes" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  try {
    const { id } = await params;
    const cursoId = parseInt(id);
    const { estudianteId } = await request.json();

    const [existing] = await db
      .select({ id: cursoEstudiantes.id })
      .from(cursoEstudiantes)
      .where(and(eq(cursoEstudiantes.cursoId, cursoId), eq(cursoEstudiantes.estudianteId, estudianteId)))
      .limit(1);

    if (existing) {
      return NextResponse.json({ error: "El estudiante ya esta en este curso" }, { status: 400 });
    }

    await db.insert(cursoEstudiantes).values({ cursoId, estudianteId });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Add student error:", error);
    return NextResponse.json({ error: "Error al agregar estudiante" }, { status: 500 });
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
    const cursoId = parseInt(id);
    const { estudianteId } = await request.json();

    await db
      .delete(cursoEstudiantes)
      .where(and(eq(cursoEstudiantes.cursoId, cursoId), eq(cursoEstudiantes.estudianteId, estudianteId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove student error:", error);
    return NextResponse.json({ error: "Error al quitar estudiante" }, { status: 500 });
  }
}
