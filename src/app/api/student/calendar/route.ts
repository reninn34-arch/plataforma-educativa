import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignments, assignmentSubmissions, subjects } from "@/lib/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

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
    data = await db
      .select({
        id: assignments.id,
        title: assignments.title,
        subjectName: subjects.name,
        subjectEmoji: subjects.emoji,
        dueDate: assignments.dueDate,
        submissionCount: db.$count(assignmentSubmissions, eq(assignmentSubmissions.assignmentId, assignments.id)),
      })
      .from(assignments)
      .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
      .where(and(
        eq(assignments.teacherId, user.id),
        isNotNull(assignments.dueDate)
      ));
  }

  return NextResponse.json({ events: data });
}
