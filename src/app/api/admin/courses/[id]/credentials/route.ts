import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cursoEstudiantes, users, cursos } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  try {
    const { id } = await params;
    const cursoId = parseInt(id);

    const [curso] = await db.select({ nombre: cursos.nombre, nivel: cursos.nivel }).from(cursos).where(eq(cursos.id, cursoId)).limit(1);
    if (!curso) return NextResponse.json({ error: "Curso no encontrado" }, { status: 404 });

    const students = await db
      .select({
        cedula: users.cedula,
        fullName: users.fullName,
        email: users.email,
      })
      .from(cursoEstudiantes)
      .leftJoin(users, eq(cursoEstudiantes.estudianteId, users.id))
      .where(eq(cursoEstudiantes.cursoId, cursoId))
      .orderBy(users.fullName);

    return NextResponse.json({
      curso: curso.nombre,
      nivel: curso.nivel,
      students,
    });
  } catch (error) {
    console.error("Credentials error:", error);
    return NextResponse.json({ error: "Error al cargar credenciales" }, { status: 500 });
  }
}
