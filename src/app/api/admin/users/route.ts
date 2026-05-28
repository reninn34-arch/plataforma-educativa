import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  try {
    const role = request.nextUrl.searchParams.get("role") || "student";
    const showInactive = request.nextUrl.searchParams.get("inactive") === "true";
    const conditions: any[] = [eq(users.role, role as any)];
    if (!showInactive) conditions.push(eq(users.activo, true));
    const data = await db
      .select({ id: users.id, cedula: users.cedula, fullName: users.fullName, role: users.role, email: users.email, activo: users.activo, createdAt: users.createdAt })
      .from(users)
      .where(and(...conditions))
      .orderBy(desc(users.createdAt));

    return NextResponse.json({ users: data });
  } catch (error) {
    console.error("Admin users error:", error);
    return NextResponse.json({ error: "Error al cargar usuarios" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  try {
    const { cedula, fullName, role, email } = await request.json();

    if (!cedula || cedula.length !== 10 || !fullName || !role) {
      return NextResponse.json({ error: "Cedula (10 digitos), nombre y rol requeridos" }, { status: 400 });
    }
    if (!["student", "teacher"].includes(role)) {
      return NextResponse.json({ error: "Rol invalido" }, { status: 400 });
    }

    const [existing] = await db.select({ id: users.id, activo: users.activo }).from(users).where(eq(users.cedula, cedula)).limit(1);
    if (existing) {
      if (!existing.activo) {
        await db.update(users).set({ activo: true, fullName, role: role as any, email: email || null }).where(eq(users.id, existing.id));
        const pin = generatePin();
        const hashed = await bcrypt.hash(pin, 10);
        await db.update(users).set({ pin: hashed }).where(eq(users.id, existing.id));
        return NextResponse.json({ user: { id: existing.id, cedula, fullName, role, pin }, pin, reactivado: true }, { status: 200 });
      }
      return NextResponse.json({ error: "Ya existe un usuario con esa cedula" }, { status: 400 });
    }

    const pin = generatePin();
    const hashed = await bcrypt.hash(pin, 10);

    const [created] = await db.insert(users).values({
      cedula,
      fullName,
      role: role as any,
      email: email || null,
      pin: hashed,
    }).returning();

    return NextResponse.json({ user: { id: created.id, cedula, fullName, role, pin }, pin }, { status: 201 });
  } catch (error) {
    console.error("Admin create user error:", error);
    return NextResponse.json({ error: "Error al crear usuario" }, { status: 500 });
  }
}
