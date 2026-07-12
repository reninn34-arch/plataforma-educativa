/**
 * @swagger
 * /api/docs/spec:
 *   get:
 *     summary: Obtener especificación OpenAPI
 *     description: Devuelve la especificación OpenAPI 3.1 completa del sistema en formato JSON. Endpoint público sin autenticación.
 *     tags: [Documentación]
 *     responses:
 *       200:
 *         description: Especificación OpenAPI
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: "Objeto OpenAPI 3.1 con paths, schemas y config"
 *       500:
 *         description: Error interno
 */
import { NextResponse } from "next/server";
import { swaggerSpec } from "@/lib/swagger";

export async function GET() {
  return NextResponse.json(swaggerSpec);
}