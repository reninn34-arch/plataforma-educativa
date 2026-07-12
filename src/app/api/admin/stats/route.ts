/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     summary: Estadísticas del dashboard
 *     description: Devuelve el conteo total de estudiantes, profesores y cursos activos.
 *     tags: [Administración]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas del sistema
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalEstudiantes: { type: integer }
 *                 totalProfesores: { type: integer }
 *                 totalCursos: { type: integer }
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       500:
 *         description: Error interno
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, cursos } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  try {
    const [rolesCount, [courseCount]] = await Promise.all([
      db.select({ role: users.role, count: sql<number>`count(*)`.mapWith(Number) }).from(users).groupBy(users.role),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(cursos).where(eq(cursos.activo, true))
    ]);

    const roleMap = new Map(rolesCount.map(r => [r.role, r.count]));

    return NextResponse.json({
      totalEstudiantes: roleMap.get("student") || 0,
      totalProfesores: roleMap.get("teacher") || 0,
      totalCursos: courseCount?.count || 0,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json({ error: "Error al cargar estadisticas" }, { status: 500 });
  }
}
