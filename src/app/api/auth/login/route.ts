import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createToken, setSessionCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { cedula, pin } = await request.json();

    if (!cedula || !pin) {
      return NextResponse.json({ error: "Cedula y PIN requeridos" }, { status: 400 });
    }

    if (!/^\d{10}$/.test(cedula)) {
      return NextResponse.json({ error: "Cedula invalida: 10 digitos requeridos" }, { status: 400 });
    }

    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: "PIN invalido: 4 digitos requeridos" }, { status: 400 });
    }

    const [user] = await db.select().from(users).where(eq(users.cedula, cedula)).limit(1);

    if (!user) {
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    }

    const valid = await bcrypt.compare(pin, user.pin);
    if (!valid) {
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    }

    await db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, user.id));

    const token = await createToken({
      id: user.id,
      cedula: user.cedula,
      fullName: user.fullName,
      role: user.role,
    });

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, cedula: user.cedula, fullName: user.fullName, role: user.role },
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
