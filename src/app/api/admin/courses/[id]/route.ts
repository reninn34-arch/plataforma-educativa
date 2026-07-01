import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cursos, cursoEstudiantes, users, subjects, cursoProfesores } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  try {
    const { id } = await params;
    const cursoId = parseInt(id);
    const { nombre, nivel, profesorId, activo, teacherSubjects: teacherSubjectsData } = await request.json();

    const updateData: Record<string, any> = {};
    if (nombre) updateData.nombre = nombre;
    if (nivel) updateData.nivel = nivel;
    if (profesorId !== undefined) updateData.profesorId = profesorId;
    if (activo !== undefined) updateData.activo = activo;

    if (Object.keys(updateData).length > 0) {
      await db.update(cursos).set(updateData).where(eq(cursos.id, cursoId));
    }

    if (teacherSubjectsData !== undefined && Array.isArray(teacherSubjectsData)) {
      await db.transaction(async (tx) => {
        await tx.delete(cursoProfesores).where(eq(cursoProfesores.cursoId, cursoId));
        if (teacherSubjectsData.length > 0) {
          await tx.insert(cursoProfesores).values(
            teacherSubjectsData.map((ts: { teacherId: number; subjectId: number }) => ({
              cursoId,
              teacherId: ts.teacherId,
              subjectId: ts.subjectId,
            }))
          );
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin update course error:", error);
    return NextResponse.json({ error: "Error al actualizar curso" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  try {
    const { id } = await params;
    const cursoId = parseInt(id);

    await db.delete(cursoProfesores).where(eq(cursoProfesores.cursoId, cursoId));
    await db.delete(cursoEstudiantes).where(eq(cursoEstudiantes.cursoId, cursoId));
    await db.delete(cursos).where(eq(cursos.id, cursoId));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin delete course error:", error);
    return NextResponse.json({ error: "Error al eliminar curso" }, { status: 500 });
  }
}
