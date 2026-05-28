import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { periodosLectivos } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  try {
    const { id } = await params;
    const { nombre, fechaInicio, fechaFin, activo } = await request.json();
    const updateData: Record<string, any> = {};
    if (nombre) updateData.nombre = nombre;
    if (fechaInicio !== undefined) updateData.fechaInicio = fechaInicio ? new Date(fechaInicio) : null;
    if (fechaFin !== undefined) updateData.fechaFin = fechaFin ? new Date(fechaFin) : null;
    if (activo !== undefined) updateData.activo = activo;

    await db.update(periodosLectivos).set(updateData).where(eq(periodosLectivos.id, parseInt(id)));
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
  const user = token ? await verifyToken(token) : null;
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  try {
    const { id } = await params;
    await db.delete(periodosLectivos).where(eq(periodosLectivos.id, parseInt(id)));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
