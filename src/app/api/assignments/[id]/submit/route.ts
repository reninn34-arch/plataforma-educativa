import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { db } from "@/lib/db";
import { assignmentSubmissions, submissionAnswers, assignmentQuestions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = [
  "application/pdf", "image/jpeg", "image/png", "image/webp",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain", "application/zip",
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user || user.role !== "student") {
    return NextResponse.json({ error: "Solo estudiantes pueden entregar" }, { status: 403 });
  }

  const { id } = await params;
  const assignmentId = parseInt(id);

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const answersJson = formData.get("answers") as string | null;

    let fileUrl: string | null = null;
    let content: string | null = null;

    // Handle file upload
    if (file && file.size > 0) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: "Archivo excede 10 MB" }, { status: 400 });
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json({ error: "Formato no permitido" }, { status: 400 });
      }

      const uploadsDir = join(process.cwd(), "public", "uploads", "assignments");
      await mkdir(uploadsDir, { recursive: true });

      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileName = `${assignmentId}_${user.id}_${timestamp}_${safeName}`;

      const bytes = await file.arrayBuffer();
      await writeFile(join(uploadsDir, fileName), Buffer.from(bytes));

      fileUrl = `/uploads/assignments/${fileName}`;
      content = file.name;
    }

    // Upsert submission
    const [existing] = await db
      .select({ id: assignmentSubmissions.id })
      .from(assignmentSubmissions)
      .where(and(
        eq(assignmentSubmissions.assignmentId, assignmentId),
        eq(assignmentSubmissions.studentId, user.id)
      ));

    let submissionId: number;

    if (existing) {
      await db
        .update(assignmentSubmissions)
        .set({
          ...(fileUrl && { fileUrl, content }),
          status: "submitted",
          submittedAt: new Date(),
        })
        .where(eq(assignmentSubmissions.id, existing.id));
      submissionId = existing.id;
    } else {
      const [sub] = await db.insert(assignmentSubmissions).values({
        assignmentId,
        studentId: user.id,
        fileUrl,
        content,
        status: "submitted",
      } as any).returning();
      submissionId = sub.id;
    }

    // Handle MCQ answers
    if (answersJson) {
      const answers: { questionId: number; selectedIndex: number }[] = JSON.parse(answersJson);

      // Delete old answers
      await db.delete(submissionAnswers).where(eq(submissionAnswers.submissionId, submissionId));

      for (const ans of answers) {
        // Check if correct
        const [q] = await db
          .select({ correctIndex: assignmentQuestions.correctIndex })
          .from(assignmentQuestions)
          .where(eq(assignmentQuestions.id, ans.questionId));

        await db.insert(submissionAnswers).values({
          submissionId,
          questionId: ans.questionId,
          selectedIndex: ans.selectedIndex,
          isCorrect: q ? ans.selectedIndex === q.correctIndex : false,
        } as any);
      }
    }

    // Calculate auto-grade
    const allAnswers = await db
      .select({ isCorrect: submissionAnswers.isCorrect })
      .from(submissionAnswers)
      .where(eq(submissionAnswers.submissionId, submissionId));

    const correct = allAnswers.filter(a => a.isCorrect).length;
    const total = allAnswers.length;
    const autoGrade = total > 0 ? Math.round((correct / total) * 10) : null;

    if (autoGrade !== null) {
      await db
        .update(assignmentSubmissions)
        .set({ grade: autoGrade })
        .where(eq(assignmentSubmissions.id, submissionId));
    }

    return NextResponse.json({
      success: true,
      submissionId,
      fileUrl,
      mcqCorrect: correct,
      mcqTotal: total,
      autoGrade,
    });
  } catch (error) {
    console.error("Submit error:", error);
    return NextResponse.json({ error: "Error al entregar" }, { status: 500 });
  }
}
