import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { notificaciones } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { ids, all } = body;

    if (all) {
      await db
        .update(notificaciones)
        .set({ read: true })
        .where(and(eq(notificaciones.userId, user.id), eq(notificaciones.read, false)));
    } else if (ids && Array.isArray(ids) && ids.length > 0) {
      await db
        .update(notificaciones)
        .set({ read: true })
        .where(and(eq(notificaciones.userId, user.id), inArray(notificaciones.id, ids)));
    } else {
      return NextResponse.json({ error: "ids o all requerido" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error al marcar notificaciones:", error);
    return NextResponse.json({ error: "Error al marcar notificaciones" }, { status: 500 });
  }
}
