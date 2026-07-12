/**
 * @swagger
 * /api/user/theme:
 *   get:
 *     summary: Obtener preferencia de tema
 *     description: Devuelve la preferencia de tema (light, dark, system) del usuario autenticado.
 *     tags: [Usuario]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Preferencia de tema
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 theme:
 *                   type: string
 *                   enum: [light, dark, system]
 *       401:
 *         description: No autenticado
 *       500:
 *         description: Error interno
 *   put:
 *     summary: Actualizar preferencia de tema
 *     description: Actualiza la preferencia de tema del usuario autenticado.
 *     tags: [Usuario]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [theme]
 *             properties:
 *               theme:
 *                 type: string
 *                 enum: [light, dark, system]
 *                 description: "Tema seleccionado"
 *     responses:
 *       200:
 *         description: Tema actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 theme: { type: string, enum: [light, dark, system] }
 *       400:
 *         description: Tema inválido
 *       401:
 *         description: No autenticado
 *       500:
 *         description: Error interno
 */
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PUT(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { theme } = body;

    if (!theme || !["light", "dark", "system"].includes(theme)) {
      return NextResponse.json({ error: "Tema inválido" }, { status: 400 });
    }

    await db.update(users).set({ themePreference: theme }).where(eq(users.id, user.id));

    return NextResponse.json({ success: true, theme });
  } catch (error) {
    console.error("Theme update error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const [dbUser] = await db.select({ themePreference: users.themePreference }).from(users).where(eq(users.id, user.id)).limit(1);

    return NextResponse.json({ theme: dbUser?.themePreference || "system" });
  } catch (error) {
    console.error("Theme get error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}