import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { assignments, assignmentSubmissions, subjects, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

function escapeCSV(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("atlas-edu-token")?.value;
    const user = token ? await verifyToken(token) : null;
    if (!user || user.role !== "teacher") {
      return Response.json({ error: "Solo docentes" }, { status: 403 });
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
      .where(eq(assignments.teacherId, user.id))
      .limit(1000);

    const BOM = "\uFEFF";
    const header = "Estudiante,Cedula,Materia,Tarea,Trimestre,Nota,Feedback";
    const rows = data.map(r =>
      [r.studentName, r.studentCedula, r.subjectName, r.assignmentTitle, `T${r.trimester}`, r.grade ?? "", r.feedback || ""]
        .map(escapeCSV)
        .join(",")
    );
    const csv = BOM + [header, ...rows].join("\n");
    const dateStr = new Date().toISOString().slice(0, 10);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=calificaciones_atlas_edu_${dateStr}.csv`,
        "Content-Length": String(new TextEncoder().encode(csv).length),
      },
    });
  } catch (error) {
    console.error("GET /api/analytics/export error:", error);
    return Response.json({ error: "Error al exportar" }, { status: 500 });
  }
}
