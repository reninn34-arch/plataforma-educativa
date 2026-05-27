import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignments, assignmentQuestions, assignmentSubmissions, submissionAnswers, subjects, users } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get("atlas-edu-token")?.value;
    const user = token ? await verifyToken(token) : null;
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id } = await params;
    const assignmentId = parseInt(id);

    const [assignment] = await db
      .select({
        id: assignments.id,
        title: assignments.title,
        description: assignments.description,
        dueDate: assignments.dueDate,
        createdAt: assignments.createdAt,
        subjectName: subjects.name,
        subjectEmoji: subjects.emoji,
        subjectSlug: subjects.slug,
        subjectId: assignments.subjectId,
        teacherName: users.fullName,
      })
      .from(assignments)
      .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
      .leftJoin(users, eq(assignments.teacherId, users.id))
      .where(eq(assignments.id, assignmentId));

    if (!assignment) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }

    // Get questions
    const questions = await db
      .select()
      .from(assignmentQuestions)
      .where(eq(assignmentQuestions.assignmentId, assignmentId))
      .orderBy(asc(assignmentQuestions.orderIndex));

    // Get submissions
    let submissions: any[] = [];
    if (user.role === "teacher") {
      submissions = await db
        .select({
          id: assignmentSubmissions.id,
          studentId: assignmentSubmissions.studentId,
          studentName: users.fullName,
          studentCedula: users.cedula,
          content: assignmentSubmissions.content,
          fileUrl: assignmentSubmissions.fileUrl,
          status: assignmentSubmissions.status,
          submittedAt: assignmentSubmissions.submittedAt,
          grade: assignmentSubmissions.grade,
          feedback: assignmentSubmissions.feedback,
        })
        .from(assignmentSubmissions)
        .leftJoin(users, eq(assignmentSubmissions.studentId, users.id))
        .where(eq(assignmentSubmissions.assignmentId, assignmentId));

      // Get answers per submission
      const allAnswers = await db
        .select()
        .from(submissionAnswers)
        .leftJoin(assignmentQuestions, eq(submissionAnswers.questionId, assignmentQuestions.id))
        .where(
          and(
            eq(assignmentQuestions.assignmentId, assignmentId)
          )
        );

      submissions = submissions.map(s => ({
        ...s,
        answers: allAnswers.filter(a => a.submission_answers?.submissionId === s.id).map(a => ({
          questionId: a.assignment_questions?.id,
          question: a.assignment_questions?.question,
          type: a.assignment_questions?.type,
          selectedIndex: a.submission_answers?.selectedIndex,
          isCorrect: a.submission_answers?.isCorrect,
          correctIndex: a.assignment_questions?.correctIndex,
        })),
        mcqScore: allAnswers
          .filter(a => a.submission_answers?.submissionId === s.id && a.submission_answers?.isCorrect)
          .length,
        mcqTotal: questions.filter(q => q.type === "mcq").length,
      }));
    } else {
      const [sub] = await db
        .select({
          id: assignmentSubmissions.id,
          content: assignmentSubmissions.content,
          fileUrl: assignmentSubmissions.fileUrl,
          status: assignmentSubmissions.status,
          submittedAt: assignmentSubmissions.submittedAt,
          grade: assignmentSubmissions.grade,
          feedback: assignmentSubmissions.feedback,
        })
        .from(assignmentSubmissions)
        .where(
          and(
            eq(assignmentSubmissions.assignmentId, assignmentId),
            eq(assignmentSubmissions.studentId, user.id)
          )
        );

      if (sub) {
        const answers = await db
          .select()
          .from(submissionAnswers)
          .where(eq(submissionAnswers.submissionId, sub.id));

        submissions = [{ ...sub, answers: answers.map(a => ({
          questionId: a.questionId,
          selectedIndex: a.selectedIndex,
          isCorrect: a.isCorrect,
        })) }];
      } else {
        submissions = [];
      }
    }

    return NextResponse.json({
      assignment,
      questions: questions.map(q => ({
        id: q.id,
        type: q.type,
        question: q.question,
        options: q.options,
        points: q.points,
        orderIndex: q.orderIndex,
        // Only send correctIndex to teacher
        correctIndex: user.role === "teacher" ? q.correctIndex : undefined,
      })),
      submissions,
      role: user.role,
    });
  } catch (error) {
    console.error("GET /api/assignments/[id] error:", error);
    return NextResponse.json({ error: "Error en la tarea" }, { status: 500 });
  }
}

// PUT: edit assignment
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get("atlas-edu-token")?.value;
    const user = token ? await verifyToken(token) : null;
    if (!user || user.role !== "teacher") {
      return NextResponse.json({ error: "Solo docentes pueden editar" }, { status: 403 });
    }

    const { id } = await params;
    const assignmentId = parseInt(id);

    const { title, description, dueDate, trimester, questions } = await request.json();

    if (!title || !description) {
      return NextResponse.json({ error: "Titulo y descripcion requeridos" }, { status: 400 });
    }

    // Update assignment
    await db
      .update(assignments)
      .set({
        title,
        description,
        dueDate: dueDate || null,
        trimester: trimester || 1,
      } as any)
      .where(eq(assignments.id, assignmentId));

    // Replace questions
    if (questions) {
      await db.delete(submissionAnswers)
        .where(eq(submissionAnswers.questionId, assignmentId));

      await db.delete(assignmentQuestions)
        .where(eq(assignmentQuestions.assignmentId, assignmentId));

      if (questions.length > 0) {
        await db.insert(assignmentQuestions).values(
          questions.map((q: { type: string; question: string; options?: string[]; correctIndex?: number; points?: number }, i: number) => ({
            assignmentId,
            type: q.type,
            question: q.question,
            options: q.options || null,
            correctIndex: q.correctIndex ?? null,
            points: q.points || 1,
            orderIndex: i,
          } as any))
        );
      }
    }

    return NextResponse.json({ success: true, updated: true });
  } catch (error) {
    console.error("PUT /api/assignments/[id] error:", error);
    return NextResponse.json({ error: "Error en la tarea" }, { status: 500 });
  }
}

// DELETE: delete assignment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get("atlas-edu-token")?.value;
    const user = token ? await verifyToken(token) : null;
    if (!user || user.role !== "teacher") {
      return NextResponse.json({ error: "Solo docentes pueden eliminar" }, { status: 403 });
    }

    const { id } = await params;
    const assignmentId = parseInt(id);

    // Cascade delete
    await db.delete(submissionAnswers)
      .where(eq(submissionAnswers.questionId, assignmentId));

    await db.delete(assignmentSubmissions)
      .where(eq(assignmentSubmissions.assignmentId, assignmentId));

    await db.delete(assignmentQuestions)
      .where(eq(assignmentQuestions.assignmentId, assignmentId));

    await db.delete(assignments)
      .where(eq(assignments.id, assignmentId));

    return NextResponse.json({ success: true, deleted: true });
  } catch (error) {
    console.error("DELETE /api/assignments/[id] error:", error);
    return NextResponse.json({ error: "Error en la tarea" }, { status: 500 });
  }
}
