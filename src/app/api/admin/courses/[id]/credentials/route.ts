/**
 * @swagger
 * /api/admin/courses/{id}/credentials:
 *   get:
 *     summary: Exportar credenciales de un curso
 *     description: Devuelve la lista de estudiantes del curso con sus datos (sin PIN por seguridad).
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
 *         description: Datos del curso y estudiantes
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       404:
 *         description: Curso no encontrado
 *       500:
 *         description: Error interno
 *   post:
 *     summary: Regenerar credenciales de un curso
 *     description: Genera nuevos PINs para todos los estudiantes del curso y los devuelve.
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
 *         description: Credenciales regeneradas con nuevos PINs
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       404:
 *         description: Curso no encontrado
 *       500:
 *         description: Error interno
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cursoEstudiantes, users, cursos } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { hashPin } from "@/lib/hash-utils";

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

    const [curso] = await db.select({ nombre: cursos.nombre, nivel: cursos.nivel }).from(cursos).where(eq(cursos.id, cursoId)).limit(1);
    if (!curso) return NextResponse.json({ error: "Curso no encontrado" }, { status: 404 });

    const students = await db
      .select({
        cedula: users.cedula,
        fullName: users.fullName,
        email: users.email,
      })
      .from(cursoEstudiantes)
      .leftJoin(users, eq(cursoEstudiantes.estudianteId, users.id))
      .where(eq(cursoEstudiantes.cursoId, cursoId))
      .orderBy(users.fullName);

    // Return students with pin as null (not retrieved for security)
    const formatted = students.map(s => ({
      ...s,
      pin: null,
    }));

    return NextResponse.json({
      curso: curso.nombre,
      nivel: curso.nivel,
      students: formatted,
    });
  } catch (error) {
    console.error("Credentials error:", error);
    return NextResponse.json({ error: "Error al cargar credenciales" }, { status: 500 });
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

    const [curso] = await db.select({ nombre: cursos.nombre, nivel: cursos.nivel }).from(cursos).where(eq(cursos.id, cursoId)).limit(1);
    if (!curso) return NextResponse.json({ error: "Curso no encontrado" }, { status: 404 });

    const enrollments = await db
      .select({
        id: users.id,
        cedula: users.cedula,
        fullName: users.fullName,
        email: users.email,
      })
      .from(cursoEstudiantes)
      .leftJoin(users, eq(cursoEstudiantes.estudianteId, users.id))
      .where(eq(cursoEstudiantes.cursoId, cursoId));

    const studentsWithNewPins = [];

    for (const s of enrollments) {
      if (!s.id) continue;
      const pin = String(Math.floor(1000 + Math.random() * 9000));
      const hashed = await hashPin(pin);
      await db.update(users).set({ pin: hashed, pinUpdatedAt: sql`now()` }).where(eq(users.id, s.id));
      studentsWithNewPins.push({
        cedula: s.cedula || "",
        fullName: s.fullName || "",
        email: s.email,
        pin,
      });
    }

    studentsWithNewPins.sort((a, b) => a.fullName.localeCompare(b.fullName));

    return NextResponse.json({
      curso: curso.nombre,
      nivel: curso.nivel,
      students: studentsWithNewPins,
    });
  } catch (error) {
    console.error("Bulk reset credentials error:", error);
    return NextResponse.json({ error: "Error al regenerar credenciales" }, { status: 500 });
  }
}
