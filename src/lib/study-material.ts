import { db } from "@/lib/db";
import { studyMaterials, cursoEstudiantes, subjects } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);
    return data.text || "";
  } catch {
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
