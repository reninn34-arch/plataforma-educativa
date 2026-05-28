import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createToken, setSessionCookie } from "@/lib/auth";
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
