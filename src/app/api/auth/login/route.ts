import { NextRequest, NextResponse } from "next/server";

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     description: Autentica un usuario con cédula y PIN. Devuelve JWT en cookie httpOnly.
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cedula, pin]
 *             properties:
 *               cedula:
 *                 type: string
 *                 description: Número de cédula (10 dígitos)
 *                 example: "0102030405"
 *               pin:
 *                 type: string
 *                 description: PIN de 4 dígitos
 *                 example: "1234"
 *     responses:
 *       200:
 *         description: Login exitoso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     cedula: { type: string }
 *                     fullName: { type: string }
 *                     role: { type: string, enum: [student, teacher, admin] }
 *       401:
 *         description: Credenciales incorrectas
 *         schema:
 *           type: object
 *           properties:
 *             error: { type: string, example: "Credenciales incorrectas" }
 *       429:
 *         description: Rate limit exceeded
 */
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createToken } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/api-helpers";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const rl = rateLimit({ key: `login:${ip}`, maxRequests: 10, windowMs: 60_000 });
    if (rl) return rl;

    const parsed = loginSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Cedula (10 digitos) y PIN (4 digitos) requeridos" }, { status: 400 });
    }
    const { cedula, pin } = parsed.data;

    const [user] = await db.select().from(users).where(and(eq(users.cedula, cedula), eq(users.activo, true))).limit(1);
    if (!user || !await bcrypt.compare(pin, user.pin)) {
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    }

    await db.update(users).set({ lastLogin: new Date() }).where(eq(users.id, user.id));

    const token = await createToken({
      id: user.id,
      cedula: user.cedula,
      fullName: user.fullName,
      role: user.role,
    });

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, cedula: user.cedula, fullName: user.fullName, role: user.role, themePreference: user.themePreference || "system" },
    });

    response.cookies.set("atlas-edu-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
