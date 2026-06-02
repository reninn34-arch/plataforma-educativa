import { db } from "@/lib/db";
import { studyMaterials, cursoEstudiantes, subjects } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy().catch(() => {});
    return result.text || "";
  } catch (error) {
    console.error("Error in extractPdfText:", error);
    return "";
  }
}

export async function getStudyMaterialForStudent(
  studentId: number,
  subjectSlug: string
): Promise<{ title: string; content: string } | null> {
  const subject = await db
    .select({ id: subjects.id })
    .from(subjects)
    .where(eq(subjects.slug, subjectSlug))
    .limit(1);

  if (!subject.length) return null;

  const studentCursos = await db
    .select({ cursoId: cursoEstudiantes.cursoId })
    .from(cursoEstudiantes)
    .where(eq(cursoEstudiantes.estudianteId, studentId))
    .limit(1);

  if (!studentCursos.length) return null;

  const material = await db
    .select({ title: studyMaterials.title, content: studyMaterials.content })
    .from(studyMaterials)
    .where(
      and(
        eq(studyMaterials.cursoId, studentCursos[0].cursoId),
        eq(studyMaterials.subjectId, subject[0].id)
      )
    )
    .limit(1);

  return material.length ? material[0] : null;
}
