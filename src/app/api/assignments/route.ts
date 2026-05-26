import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignments, assignmentQuestions, assignmentSubmissions, subjects, users } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

// GET: list assignments
export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (user.role === "teacher") {
    const data = await db
      .select({
        id: assignments.id,
        title: assignments.title,
        description: assignments.description,
        dueDate: assignments.dueDate,
        createdAt: assignments.createdAt,
        subjectName: subjects.name,
        subjectEmoji: subjects.emoji,
        subjectSlug: subjects.slug,
        submissionCount: db.$count(assignmentSubmissions, eq(assignmentSubmissions.assignmentId, assignments.id)),
      })
      .from(assignments)
      .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
      .where(eq(assignments.teacherId, user.id))
      .orderBy(desc(assignments.createdAt));

    return NextResponse.json({ assignments: data });
  }

  const data = await db
    .select({
      id: assignments.id,
      title: assignments.title,
      description: assignments.description,
      dueDate: assignments.dueDate,
      createdAt: assignments.createdAt,
      teacherName: users.fullName,
      subjectName: subjects.name,
      subjectEmoji: subjects.emoji,
      subjectSlug: subjects.slug,
      status: assignmentSubmissions.status,
      grade: assignmentSubmissions.grade,
    })
    .from(assignments)
    .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
    .leftJoin(users, eq(assignments.teacherId, users.id))
    .leftJoin(
      assignmentSubmissions,
      and(
        eq(assignmentSubmissions.assignmentId, assignments.id),
        eq(assignmentSubmissions.studentId, user.id)
      )
    )
    .orderBy(desc(assignments.createdAt));

  return NextResponse.json({ assignments: data });
}

// POST: create assignment with optional questions
export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "Solo docentes pueden crear tareas" }, { status: 403 });
  }

  const { title, description, subjectId, dueDate, trimester, questions } = await request.json();

  if (!title || !description || !subjectId) {
    return NextResponse.json({ error: "Titulo, descripcion y materia requeridos" }, { status: 400 });
  }

  const [assignment] = await db
    .insert(assignments)
    .values({
      teacherId: user.id,
      subjectId,
      title,
      description,
      dueDate: dueDate || null,
      trimester: trimester || 1,
    } as any)
    .returning();

  if (questions && questions.length > 0) {
    await db.insert(assignmentQuestions).values(
      questions.map((q: { type: string; question: string; options?: string[]; correctIndex?: number; points?: number }, i: number) => ({
        assignmentId: assignment.id,
        type: q.type,
        question: q.question,
        options: q.options || null,
        correctIndex: q.correctIndex ?? null,
        points: q.points || 1,
        orderIndex: i,
      } as any))
    );
  }

  return NextResponse.json({ assignment, questionsCount: questions?.length || 0 });
}
