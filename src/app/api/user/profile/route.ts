import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken, createToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  return NextResponse.json({
    cedula: user.cedula,
    fullName: user.fullName,
    role: user.role,
  });
}

export async function PUT(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { newPin, currentPin } = await request.json();

  if (!newPin || !currentPin) {
    return NextResponse.json({ error: "PIN actual y nuevo requeridos" }, { status: 400 });
  }

  if (!/^\d{4}$/.test(newPin)) {
    return NextResponse.json({ error: "El PIN nuevo debe ser 4 digitos" }, { status: 400 });
  }

  const [row] = await db.select({ pin: users.pin }).from(users).where(eq(users.id, user.id));
  if (!row) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const valid = await bcrypt.compare(currentPin, row.pin);
  if (!valid) return NextResponse.json({ error: "PIN actual incorrecto" }, { status: 400 });

  const hashed = await bcrypt.hash(newPin, 10);
  await db.update(users).set({ pin: hashed }).where(eq(users.id, user.id));

  const newToken = await createToken(user);
  const response = NextResponse.json({ success: true });
  response.cookies.set("atlas-edu-token", newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });

  return response;
}
