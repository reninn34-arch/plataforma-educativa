import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { periodosLectivos, assignments } from "@/lib/db/schema";
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
    const periodoId = parseInt(id);
    const { nombre, fechaInicio, fechaFin, activo } = await request.json();

    if (activo === true) {
      await db.update(periodosLectivos).set({ activo: false }).where(eq(periodosLectivos.activo, true));
    }

    const updateData: Record<string, any> = {};
    if (nombre) updateData.nombre = nombre;
    if (fechaInicio !== undefined) updateData.fechaInicio = fechaInicio ? new Date(fechaInicio) : null;
    if (fechaFin !== undefined) updateData.fechaFin = fechaFin ? new Date(fechaFin) : null;
    if (activo !== undefined) updateData.activo = activo;

    await db.update(periodosLectivos).set(updateData).where(eq(periodosLectivos.id, periodoId));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
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
    const periodoId = parseInt(id);

    const refs = await db
      .select({ id: assignments.id })
      .from(assignments)
      .where(eq(assignments.periodoLectivoId, periodoId))
      .limit(1);

    if (refs.length > 0) {
      return NextResponse.json({ error: "No se puede eliminar. Hay tareas asignadas a este periodo." }, { status: 400 });
    }

    await db.delete(periodosLectivos).where(eq(periodosLectivos.id, periodoId));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
