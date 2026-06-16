import { NextRequest, NextResponse } from "next/server";

/**
 * @swagger
 * /api/user/profile:
 *   get:
 *     summary: Perfil del usuario
 *     description: Devuelve datos del perfil del usuario autenticado.
 *     tags: [Usuario]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Datos del perfil
 *       401:
 *         description: No autorizado
 *   put:
 *     summary: Actualizar perfil
 *     description: Actualiza el nombre, email o PIN del usuario.
 *     tags: [Usuario]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName: { type: string }
 *               email: { type: string }
 *               pinActual: { type: string, description: "PIN actual para cambiar PIN" }
 *               pinNuevo: { type: string, description: "Nuevo PIN de 4 dígitos" }
 *     responses:
 *       200:
 *         description: Perfil actualizado
 *       400:
 *         description: PIN actual incorrecto
 */
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { verifyToken, getVerifiedUser, createToken } from "@/lib/auth";
import { profileSchema, isValidPin } from "@/lib/api-helpers";
import { hashPin, comparePin } from "@/lib/hash-utils";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const [dbUser] = await db.select({
      id: users.id,
      cedula: users.cedula,
      fullName: users.fullName,
      role: users.role,
      email: users.email,
    }).from(users).where(eq(users.id, user.id));
    if (!dbUser) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    return NextResponse.json({
      id: dbUser.id,
      cedula: dbUser.cedula,
      fullName: dbUser.fullName,
      role: dbUser.role,
      email: dbUser.email,
    });
  } catch {
    return NextResponse.json({ error: "Error al cargar perfil" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }
    const { newPin, currentPin } = parsed.data;

    const pinCheck = isValidPin(newPin);
    if (!pinCheck.valid) {
      return NextResponse.json({ error: pinCheck.reason }, { status: 400 });
    }

    const [row] = await db.select({ pin: users.pin }).from(users).where(eq(users.id, user.id));
    if (!row) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    const valid = await comparePin(currentPin, row.pin);
    if (!valid) return NextResponse.json({ error: "PIN actual incorrecto" }, { status: 400 });

    if (currentPin === newPin) {
      return NextResponse.json({ error: "El nuevo PIN debe ser diferente al actual" }, { status: 400 });
    }

    const hashed = await hashPin(newPin);
    await db.update(users).set({
      pin: hashed,
      pinUpdatedAt: sql`now()`,
    }).where(eq(users.id, user.id));

    const freshUser = { id: user.id, cedula: user.cedula, fullName: user.fullName, role: user.role };
    const newToken = await createToken(freshUser);
    const response = NextResponse.json({ success: true });
    response.cookies.set("atlas-edu-token", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Error al actualizar perfil" }, { status: 500 });
  }
}
