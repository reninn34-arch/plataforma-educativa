import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subjects } from "@/lib/db/schema";

export async function GET() {
  try {
    const data = await db.select().from(subjects).orderBy(subjects.name);
    return NextResponse.json({ subjects: data });
  } catch (error) {
    console.error("GET /api/subjects error:", error);
    return NextResponse.json({ error: "Error al cargar materias" }, { status: 500 });
  }
}
