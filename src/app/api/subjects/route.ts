import { NextRequest, NextResponse } from "next/server";

/**
 * @swagger
 * /api/subjects:
 *   get:
 *     summary: Listar materias
 *     description: Devuelve todas las materias disponibles en el sistema.
 *     tags: [General]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de materias
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 subjects:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       name: { type: string }
 *                       emoji: { type: string }
 *                       slug: { type: string }
 */
import { db } from "@/lib/db";
import { subjects } from "@/lib/db/schema";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("atlas-edu-token")?.value;
    const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const data = await db.select().from(subjects).orderBy(subjects.name);
    return NextResponse.json({ subjects: data });
  } catch (error) {
    console.error("GET /api/subjects error:", error);
    return NextResponse.json({ error: "Error al cargar materias" }, { status: 500 });
  }
}
