import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Cerrar sesión
 *     description: Destruye la cookie de sesión JWT.
 *     tags: [Autenticación]
 *     responses:
 *       200:
 *         description: Sesión cerrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 */

export async function POST() {
  await destroySession();
  return NextResponse.json({ success: true });
}
