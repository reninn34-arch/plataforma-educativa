import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { periodosLectivos } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  try {
    const data = await db.select().from(periodosLectivos).orderBy(desc(periodosLectivos.createdAt));
    return NextResponse.json({ periodos: data });
  } catch (error) {
    return NextResponse.json({ error: "Error al cargar periodos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  try {
    const { nombre, fechaInicio, fechaFin } = await request.json();
    if (!nombre) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });

    await db.update(periodosLectivos).set({ activo: false }).where(eq(periodosLectivos.activo, true));

    const [created] = await db.insert(periodosLectivos).values({
      nombre,
      fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
      fechaFin: fechaFin ? new Date(fechaFin) : null,
      activo: true,
    }).returning();

    return NextResponse.json({ periodo: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Error al crear periodo" }, { status: 500 });
  }
}
