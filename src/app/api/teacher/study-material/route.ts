import { NextRequest, NextResponse } from "next/server";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { studyMaterials } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { extractPdfText } from "@/lib/study-material";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "Solo docentes" }, { status: 403 });
  }

  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const cursoId = Number(formData.get("cursoId"));
      const subjectId = Number(formData.get("subjectId"));
      const file = formData.get("file") as File | null;

      if (!cursoId || !subjectId || !file) {
        return NextResponse.json({ error: "cursoId, subjectId y file son requeridos" }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const content = await extractPdfText(buffer);
      if (!content.trim()) {
        return NextResponse.json({ error: "No se pudo extraer texto del PDF" }, { status: 400 });
      }

      const title = file.name.replace(/\.pdf$/i, "");

      await db
        .insert(studyMaterials)
        .values({ cursoId, subjectId, title, content, fileType: "pdf", teacherId: user.id })
        .onConflictDoUpdate({
          target: [studyMaterials.cursoId, studyMaterials.subjectId],
          set: { title, content, fileType: "pdf", teacherId: user.id, updatedAt: new Date() },
        });

      return NextResponse.json({ success: true });
    }

    const { cursoId, subjectId, title, content } = await request.json();
    if (!cursoId || !subjectId || !title || !content) {
      return NextResponse.json({ error: "cursoId, subjectId, title y content son requeridos" }, { status: 400 });
    }

    await db
      .insert(studyMaterials)
      .values({ cursoId, subjectId, title, content, fileType: "pasted", teacherId: user.id })
      .onConflictDoUpdate({
        target: [studyMaterials.cursoId, studyMaterials.subjectId],
        set: { title, content, fileType: "pasted", teacherId: user.id, updatedAt: new Date() },
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[study-material] error:", error);
    return NextResponse.json({ error: "Error al guardar material" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "Solo docentes" }, { status: 403 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const cursoId = searchParams.get("cursoId");
    const subjectId = searchParams.get("subjectId");

    const conditions = [];
    if (cursoId) conditions.push(eq(studyMaterials.cursoId, Number(cursoId)));
    if (subjectId) conditions.push(eq(studyMaterials.subjectId, Number(subjectId)));

    const query = db
      .select({
        id: studyMaterials.id,
        cursoId: studyMaterials.cursoId,
        subjectId: studyMaterials.subjectId,
        title: studyMaterials.title,
        content: studyMaterials.content,
        fileType: studyMaterials.fileType,
        createdAt: studyMaterials.createdAt,
      })
      .from(studyMaterials)
      .orderBy(studyMaterials.createdAt);

    const materials = conditions.length
      ? await query.where(and(...conditions))
      : await query;

    return NextResponse.json({ materials });
  } catch (error) {
    console.error("[study-material] list error:", error);
    return NextResponse.json({ error: "Error al listar materiales" }, { status: 500 });
  }
}
