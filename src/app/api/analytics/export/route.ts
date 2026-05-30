import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { assignments, assignmentSubmissions, subjects, users, cursos } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { getTeacherCourseIds } from "@/lib/course-helpers";

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

    const cursoIdParam = request.nextUrl.searchParams.get("cursoId");

    const allIds = await getTeacherCourseIds(user.id);

    let targetCursoIds: number[] | null = null;
    if (cursoIdParam) {
      const cid = parseInt(cursoIdParam);
      if (!allIds.includes(cid)) {
        return Response.json({ error: "No tienes acceso a este curso" }, { status: 403 });
      }
      targetCursoIds = [cid];
    } else if (allIds.length > 0) {
      targetCursoIds = allIds;
    }

    const conditions: any[] = [eq(assignments.teacherId, user.id)];
    if (targetCursoIds) {
      conditions.push(inArray(assignments.cursoId, targetCursoIds));
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
        cursoNombre: cursos.nombre,
      })
      .from(assignmentSubmissions)
      .leftJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id))
      .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
      .leftJoin(users, eq(assignmentSubmissions.studentId, users.id))
      .leftJoin(cursos, eq(assignments.cursoId, cursos.id))
      .where(and(...conditions))
      .limit(1000);

    const BOM = "\uFEFF";
    const header = "Estudiante,Cedula,Curso,Materia,Tarea,Trimestre,Nota,Feedback";
    const rows = data.map(r =>
      [r.studentName, r.studentCedula, r.cursoNombre || "", r.subjectName, r.assignmentTitle, `T${r.trimester}`, r.grade ?? "", r.feedback || ""]
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
