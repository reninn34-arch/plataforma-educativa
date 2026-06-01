import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignments, assignmentSubmissions, subjects } from "@/lib/db/schema";
import { eq, and, inArray, isNotNull, sql } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
  let data: any[] = [];

  if (user.role === "student") {
    data = await db
      .select({
        id: assignments.id,
        title: assignments.title,
        subjectName: subjects.name,
        subjectEmoji: subjects.emoji,
        subjectSlug: subjects.slug,
        dueDate: assignments.dueDate,
        status: assignmentSubmissions.status,
      })
      .from(assignments)
      .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
      .leftJoin(assignmentSubmissions, and(
        eq(assignmentSubmissions.assignmentId, assignments.id),
        eq(assignmentSubmissions.studentId, user.id)
      ))
      .where(isNotNull(assignments.dueDate));
  } else {
    // Teacher sees all assignments
    const raw = await db
      .select({
        id: assignments.id,
        title: assignments.title,
        subjectName: subjects.name,
        subjectEmoji: subjects.emoji,
        dueDate: assignments.dueDate,
      })
      .from(assignments)
      .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
      .where(and(
        eq(assignments.teacherId, user.id),
        isNotNull(assignments.dueDate)
      ));

    const ids = raw.map(a => a.id);
    const counts = ids.length > 0 ? await db
      .select({
        assignmentId: assignmentSubmissions.assignmentId,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(assignmentSubmissions)
      .where(inArray(assignmentSubmissions.assignmentId, ids))
      .groupBy(assignmentSubmissions.assignmentId) : [];
    const countMap = new Map(counts.map(c => [c.assignmentId, c.count]));

    data = raw.map(a => ({ ...a, submissionCount: countMap.get(a.id) || 0 }));
  }

  return NextResponse.json({ events: data });
  } catch {
    return NextResponse.json({ error: "Error al cargar calendario" }, { status: 500 });
  }
}
