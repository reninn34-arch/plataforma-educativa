import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subjects } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  try {
    const data = await db.select().from(subjects).orderBy(subjects.name);
    return NextResponse.json({ subjects: data });
  } catch (error) {
    console.error("GET /api/admin/subjects error:", error);
    return NextResponse.json({ error: "Error al cargar materias" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  try {
    const { name, emoji, color, slug: customSlug } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
    }
    if (!emoji || !emoji.trim()) {
      return NextResponse.json({ error: "El emoji es requerido" }, { status: 400 });
    }
    if (!color || !color.trim()) {
      return NextResponse.json({ error: "El color es requerido" }, { status: 400 });
    }

    const slug = customSlug || slugify(name);

    if (!slug) {
      return NextResponse.json({ error: "No se pudo generar un slug válido" }, { status: 400 });
    }

    const [existing] = await db
      .select({ id: subjects.id })
      .from(subjects)
      .where(or(eq(subjects.slug, slug), eq(subjects.name, name.trim())))
      .limit(1);

    if (existing) {
      return NextResponse.json({ error: "Ya existe una materia con ese nombre o slug" }, { status: 409 });
    }

    const [created] = await db
      .insert(subjects)
      .values({ slug, name: name.trim(), emoji: emoji.trim(), color: color.trim() })
      .returning();

    return NextResponse.json({ subject: created }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/subjects error:", error);
    return NextResponse.json({ error: "Error al crear materia" }, { status: 500 });
  }
}
