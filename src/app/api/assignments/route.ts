import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignments, assignmentQuestions, assignmentSubmissions, subjects, users, cursos, periodosLectivos, cursoEstudiantes } from "@/lib/db/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { teacherHasCourseAccess } from "@/lib/course-helpers";
import { assignmentSchema } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("atlas-edu-token")?.value;
    const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
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
          periodoNombre: periodosLectivos.nombre,
          puntos: assignments.puntos,
          trimester: assignments.trimester,
        })
        .from(assignments)
        .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
        .leftJoin(cursos, eq(assignments.cursoId, cursos.id))
        .leftJoin(periodosLectivos, eq(assignments.periodoLectivoId, periodosLectivos.id))
        .where(eq(assignments.teacherId, user.id))
        .orderBy(desc(assignments.createdAt));

      // Batch count submissions in one query
      const assignmentIds = data.map(a => a.id);
      const counts = assignmentIds.length > 0 ? await db
        .select({
          assignmentId: assignmentSubmissions.assignmentId,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(assignmentSubmissions)
        .where(inArray(assignmentSubmissions.assignmentId, assignmentIds))
        .groupBy(assignmentSubmissions.assignmentId) : [];
      const countMap = new Map(counts.map(c => [c.assignmentId, c.count]));

      return NextResponse.json({
        assignments: data.map(a => ({ ...a, submissionCount: countMap.get(a.id) || 0 })),
      });
    }

    // Student: only show assignments from their enrolled courses
    const enrolledCourses = await db
      .select({ cursoId: cursoEstudiantes.cursoId })
      .from(cursoEstudiantes)
      .where(eq(cursoEstudiantes.estudianteId, user.id));
    const enrolledIds = new Set(enrolledCourses.map(c => c.cursoId));

    if (enrolledIds.size === 0) {
      return NextResponse.json({ assignments: [] });
    }

    const raw = await db
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

    const data = (raw as any[]).filter((a: any) => enrolledIds.has(a.cursoId));

    return NextResponse.json({ assignments: data });
  } catch (error) {
    console.error("GET /api/assignments error:", error);
    return NextResponse.json({ error: "Error al gestionar tareas" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("atlas-edu-token")?.value;
    const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
    if (!user || user.role !== "teacher") {
      return NextResponse.json({ error: "Solo docentes pueden crear tareas" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = assignmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Datos invalidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const { title, description, subjectId, cursoId, dueDate, trimester, questions } = parsed.data;

    if (subjectId) {
      const [subjectExists] = await db
        .select({ id: subjects.id })
        .from(subjects)
        .where(eq(subjects.id, subjectId))
        .limit(1);
      if (!subjectExists) {
        return NextResponse.json({ error: "Materia no encontrada" }, { status: 400 });
      }
    }

    if (cursoId) {
      const hasAccess = await teacherHasCourseAccess(user.id, cursoId);
      if (!hasAccess) {
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
        puntos: parsed.data.puntos ?? 10,
        periodoLectivoId: activePeriod?.id || null,
      } as any)
      .returning();

    if (questions && questions.length > 0) {
      await db.insert(assignmentQuestions).values(
        questions.map((q: any, i: number) => ({
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
