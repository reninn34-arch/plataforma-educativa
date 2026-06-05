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