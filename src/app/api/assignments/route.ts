import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignments, assignmentQuestions, assignmentSubmissions, subjects, users, cursos, cursoProfesores, periodosLectivos } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { assignmentSchema } from "@/lib/api-helpers";

// GET: list assignments
export async function GET(request: NextRequest) {
  try {
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
          cursoId: assignments.cursoId,
          cursoNombre: cursos.nombre,
          submissionCount: db.$count(assignmentSubmissions, eq(assignmentSubmissions.assignmentId, assignments.id)),
        })
        .from(assignments)
        .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
        .leftJoin(cursos, eq(assignments.cursoId, cursos.id))
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
        cursoId: assignments.cursoId,
        cursoNombre: cursos.nombre,
        status: assignmentSubmissions.status,
        grade: assignmentSubmissions.grade,
      })
      .from(assignments)
      .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
      .leftJoin(users, eq(assignments.teacherId, users.id))
      .leftJoin(cursos, eq(assignments.cursoId, cursos.id))
      .leftJoin(
        assignmentSubmissions,
        and(
          eq(assignmentSubmissions.assignmentId, assignments.id),
          eq(assignmentSubmissions.studentId, user.id)
        )
      )
      .orderBy(desc(assignments.createdAt));

    return NextResponse.json({ assignments: data });
  } catch (error) {
    console.error("GET /api/assignments error:", error);
    return NextResponse.json({ error: "Error al gestionar tareas" }, { status: 500 });
  }
}

// POST: create assignment with optional questions
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("atlas-edu-token")?.value;
    const user = token ? await verifyToken(token) : null;
    if (!user || user.role !== "teacher") {
      return NextResponse.json({ error: "Solo docentes pueden crear tareas" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = assignmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Datos invalidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const { title, description, subjectId, cursoId, dueDate, trimester, questions } = parsed.data;

    const [subjectExists] = await db
      .select({ id: subjects.id })
      .from(subjects)
      .where(eq(subjects.id, subjectId))
      .limit(1);
    if (!subjectExists) {
      return NextResponse.json({ error: "Materia no encontrada" }, { status: 400 });
    }

    if (cursoId) {
      const belongs = await db
        .select({ id: cursoProfesores.id })
        .from(cursoProfesores)
        .where(and(eq(cursoProfesores.cursoId, cursoId), eq(cursoProfesores.teacherId, user.id)))
        .limit(1);
      const isTutor = await db
        .select({ id: cursos.id })
        .from(cursos)
        .where(and(eq(cursos.id, cursoId), eq(cursos.profesorId, user.id)))
        .limit(1);
      if (!belongs.length && !isTutor.length) {
        return NextResponse.json({ error: "No perteneces a este curso" }, { status: 403 });
      }
    }

    const [activePeriod] = await db
      .select({ id: periodosLectivos.id })
      .from(periodosLectivos)
      .where(eq(periodosLectivos.activo, true))
      .limit(1);

    const [assignment] = await db
      .insert(assignments)
      .values({
        teacherId: user.id,
        subjectId,
        cursoId: cursoId || null,
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : null,
        trimester: trimester || 1,
        puntos: parsed.data.puntos || 10,
        periodoLectivoId: activePeriod?.id || null,
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
  } catch (error) {
    console.error("POST /api/assignments error:", error);
    return NextResponse.json({ error: "Error al gestionar tareas" }, { status: 500 });
  }
}
