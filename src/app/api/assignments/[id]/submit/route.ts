import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { db } from "@/lib/db";
import { assignmentSubmissions, submissionAnswers, assignmentQuestions, assignments, cursoEstudiantes } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

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
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "student") {
    return NextResponse.json({ error: "Solo estudiantes pueden entregar" }, { status: 403 });
  }

  const { id } = await params;
  const assignmentId = parseInt(id);

  try {
    // Check if assignment is past due
    const [assignment] = await db
      .select({ dueDate: assignments.dueDate, cursoId: assignments.cursoId, puntos: assignments.puntos })
      .from(assignments)
      .where(eq(assignments.id, assignmentId))
      .limit(1);

    if (!assignment) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }

    if (assignment?.dueDate && new Date() > new Date(assignment.dueDate)) {
      return NextResponse.json({ error: "Plazo de entrega vencido" }, { status: 400 });
    }

    if (assignment.cursoId) {
      const enrolled = await db
        .select({ id: cursoEstudiantes.id })
        .from(cursoEstudiantes)
        .where(and(
          eq(cursoEstudiantes.cursoId, assignment.cursoId),
          eq(cursoEstudiantes.estudianteId, user.id)
        ))
        .limit(1);
      if (!enrolled.length) {
        return NextResponse.json({ error: "No estas inscrito en este curso" }, { status: 403 });
      }
    }

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

      const uploadsDir = join(process.cwd(), "uploads", "assignments");
      await mkdir(uploadsDir, { recursive: true });

      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileName = `${assignmentId}_${user.id}_${timestamp}_${safeName}`;

      const bytes = await file.arrayBuffer();
      await writeFile(join(uploadsDir, fileName), Buffer.from(bytes));

      fileUrl = `/api/uploads/assignments/${fileName}`;
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
          grade: null,
          feedback: null,
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

      // Pre-load all question correct indices in one query
      const questionIds = answers.map(a => a.questionId);
      const allQ = await db
        .select({ id: assignmentQuestions.id, correctIndex: assignmentQuestions.correctIndex })
        .from(assignmentQuestions)
        .where(inArray(assignmentQuestions.id, questionIds));
      const correctMap = new Map(allQ.map(q => [q.id, q.correctIndex]));

      for (const ans of answers) {
        const correctIndex = correctMap.get(ans.questionId);
        await db.insert(submissionAnswers).values({
          submissionId,
          questionId: ans.questionId,
          selectedIndex: ans.selectedIndex,
          isCorrect: correctIndex !== undefined ? ans.selectedIndex === correctIndex : false,
        } as any);
      }
    }

    // Calculate auto-grade only if ALL questions are MCQ
    const allQuestions = await db
      .select({ type: assignmentQuestions.type })
      .from(assignmentQuestions)
      .where(eq(assignmentQuestions.assignmentId, assignmentId));

    const mcqQuestions = allQuestions.filter(q => q.type === "mcq").length;
    const hasOnlyMcq = allQuestions.length > 0 && mcqQuestions === allQuestions.length;

    if (hasOnlyMcq) {
      const allAnswers = await db
        .select({
          isCorrect: submissionAnswers.isCorrect,
          questionId: submissionAnswers.questionId,
        })
        .from(submissionAnswers)
        .where(eq(submissionAnswers.submissionId, submissionId));

      const questionsWithPoints = await db
        .select({ id: assignmentQuestions.id, points: assignmentQuestions.points })
        .from(assignmentQuestions)
        .where(eq(assignmentQuestions.assignmentId, assignmentId));

      const pointMap = new Map(questionsWithPoints.map(q => [q.id, q.points || 1]));
      const correctIds = new Set(allAnswers.filter(a => a.isCorrect).map(a => a.questionId));

      let correctPts = 0;
      let totalPts = 0;
      for (const q of questionsWithPoints) {
        const pts = pointMap.get(q.id) || 1;
        totalPts += pts;
        if (correctIds.has(q.id)) correctPts += pts;
      }

      const assgnPts = assignment?.puntos || 10;
      const autoGrade = totalPts > 0 ? Math.round((correctPts / totalPts) * assgnPts) : null;

      if (autoGrade !== null) {
        await db
          .update(assignmentSubmissions)
          .set({ grade: autoGrade })
          .where(eq(assignmentSubmissions.id, submissionId));
      }
    }

    return NextResponse.json({
      success: true,
      submissionId,
      fileUrl,
      autoGraded: hasOnlyMcq,
    });
  } catch (error) {
    console.error("Submit error:", error);
    return NextResponse.json({ error: "Error al entregar" }, { status: 500 });
  }
}
