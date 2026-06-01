import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { token, newPin } = await request.json();

    if (!token || !newPin || !/^\d{4}$/.test(newPin)) {
      return NextResponse.json({ error: "PIN debe ser de 4 digitos" }, { status: 400 });
    }

    const payload = getVerifiedUser(request) ?? (await verifyToken(token));
    if (!payload) {
      return NextResponse.json({ error: "El enlace expiro o es invalido. Solicita uno nuevo." }, { status: 400 });
    }

    const userId = payload.id;
    const hashed = await bcrypt.hash(newPin, 10);
    await db.update(users).set({ pin: hashed }).where(eq(users.id, userId));

    return NextResponse.json({ message: "PIN actualizado correctamente. Ya puedes iniciar sesion." });
  } catch (error) {
    console.error("Reset PIN error:", error);
    return NextResponse.json({ error: "El enlace expiro o es invalido." }, { status: 400 });
  }
}
