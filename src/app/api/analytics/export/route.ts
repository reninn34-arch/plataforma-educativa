import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignments, assignmentSubmissions, subjects, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "Solo docentes" }, { status: 403 });
  }

  const data = await db
    .select({
      studentName: users.fullName,
      studentCedula: users.cedula,
      subjectName: subjects.name,
      subjectEmoji: subjects.emoji,
      assignmentTitle: assignments.title,
      trimester: assignments.trimester,
      grade: assignmentSubmissions.grade,
      feedback: assignmentSubmissions.feedback,
    })
    .from(assignmentSubmissions)
    .leftJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id))
    .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
    .leftJoin(users, eq(assignmentSubmissions.studentId, users.id))
    .where(and(
      eq(assignments.teacherId, user.id),
      eq(assignmentSubmissions.status, "graded")
    ));

  // Build CSV
  const header = "Estudiante,Cedula,Materia,Tarea,Trimestre,Nota,Feedback";
  const rows = data.map(r =>
    `"${r.studentName}","${r.studentCedula}","${r.subjectName}","${r.assignmentTitle}",T${r.trimester},${r.grade ?? ""},"${r.feedback || ""}"`
  );
  const csv = [header, ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=calificaciones_atlas_edu.csv",
    },
  });
}
