import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignments, assignmentSubmissions, subjects, users, cursos } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  try {
    const data = await db
      .select({
        cursoId: cursos.id,
        cursoNombre: cursos.nombre,
        studentId: users.id,
        studentName: users.fullName,
        studentCedula: users.cedula,
        subjectName: subjects.name,
        subjectEmoji: subjects.emoji,
        assignmentTitle: assignments.title,
        trimester: assignments.trimester,
        grade: assignmentSubmissions.grade,
        status: assignmentSubmissions.status,
        submittedAt: assignmentSubmissions.submittedAt,
      })
      .from(assignmentSubmissions)
      .leftJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id))
      .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
      .leftJoin(users, eq(assignmentSubmissions.studentId, users.id))
      .leftJoin(cursos, eq(assignments.cursoId, cursos.id));

    return NextResponse.json({ grades: data });
  } catch (error) {
    console.error("Admin grades error:", error);
    return NextResponse.json({ error: "Error al cargar notas" }, { status: 500 });
  }
}
