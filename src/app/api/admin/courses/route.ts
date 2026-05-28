import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cursos, cursoEstudiantes, users } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  try {
    const data = await db
      .select({
        id: cursos.id,
        nombre: cursos.nombre,
        nivel: cursos.nivel,
        profesorId: cursos.profesorId,
        profesorNombre: users.fullName,
        activo: cursos.activo,
        createdAt: cursos.createdAt,
        studentCount: sql<number>`count(${cursoEstudiantes.estudianteId})`.mapWith(Number),
      })
      .from(cursos)
      .leftJoin(users, eq(cursos.profesorId, users.id))
      .leftJoin(cursoEstudiantes, eq(cursoEstudiantes.cursoId, cursos.id))
      .groupBy(cursos.id, users.fullName)
      .orderBy(desc(cursos.createdAt));

    return NextResponse.json({ cursos: data });
  } catch (error) {
    console.error("Admin courses error:", error);
    return NextResponse.json({ error: "Error al cargar cursos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  try {
    const { nombre, nivel, profesorId } = await request.json();
    if (!nombre || !nivel) {
      return NextResponse.json({ error: "Nombre y nivel requeridos" }, { status: 400 });
    }

    const [created] = await db.insert(cursos).values({
      nombre,
      nivel,
      profesorId: profesorId || null,
    }).returning();

    return NextResponse.json({ curso: created }, { status: 201 });
  } catch (error) {
    console.error("Admin create course error:", error);
    return NextResponse.json({ error: "Error al crear curso" }, { status: 500 });
  }
}
