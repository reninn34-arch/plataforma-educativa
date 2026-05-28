import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cursoEstudiantes, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  try {
    const { id } = await params;
    const cursoId = parseInt(id);

    const data = await db
      .select({
        id: cursoEstudiantes.id,
        estudianteId: users.id,
        cedula: users.cedula,
        fullName: users.fullName,
        email: users.email,
      })
      .from(cursoEstudiantes)
      .leftJoin(users, eq(cursoEstudiantes.estudianteId, users.id))
      .where(eq(cursoEstudiantes.cursoId, cursoId))
      .orderBy(users.fullName);

    return NextResponse.json({ students: data });
  } catch (error) {
    console.error("Course students error:", error);
    return NextResponse.json({ error: "Error al cargar estudiantes" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  try {
    const { id } = await params;
    const cursoId = parseInt(id);
    const { estudianteId } = await request.json();

    const [existing] = await db
      .select({ id: cursoEstudiantes.id })
      .from(cursoEstudiantes)
      .where(and(eq(cursoEstudiantes.cursoId, cursoId), eq(cursoEstudiantes.estudianteId, estudianteId)))
      .limit(1);

    if (existing) {
      return NextResponse.json({ error: "El estudiante ya esta en este curso" }, { status: 400 });
    }

    await db.insert(cursoEstudiantes).values({ cursoId, estudianteId });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Add student error:", error);
    return NextResponse.json({ error: "Error al agregar estudiante" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  try {
    const { id } = await params;
    const cursoId = parseInt(id);
    const { estudianteId } = await request.json();

    await db
      .delete(cursoEstudiantes)
      .where(and(eq(cursoEstudiantes.cursoId, cursoId), eq(cursoEstudiantes.estudianteId, estudianteId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove student error:", error);
    return NextResponse.json({ error: "Error al quitar estudiante" }, { status: 500 });
  }
}
