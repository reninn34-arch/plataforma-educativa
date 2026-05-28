import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, cursos } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  try {
    const [studentCount] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(users).where(eq(users.role, "student"));
    const [teacherCount] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(users).where(eq(users.role, "teacher"));
    const [courseCount] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(cursos).where(eq(cursos.activo, true));

    return NextResponse.json({
      totalEstudiantes: studentCount?.count || 0,
      totalProfesores: teacherCount?.count || 0,
      totalCursos: courseCount?.count || 0,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json({ error: "Error al cargar estadisticas" }, { status: 500 });
  }
}
