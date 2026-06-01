import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignments, assignmentSubmissions, cursoEstudiantes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get("atlas-edu-token")?.value;
    const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
    if (!user || user.role !== "teacher") {
      return NextResponse.json({ error: "Solo docentes pueden calificar" }, { status: 403 });
    }

    const { id } = await params;
    const assignmentId = parseInt(id);
    const { submissionId, studentId, grade: rawGrade, feedback } = await request.json();

    if (!submissionId && !studentId) {
      return NextResponse.json({ error: "submissionId o studentId es requerido" }, { status: 400 });
    }

    const grade = rawGrade != null ? Math.round(rawGrade) : null;
    if (grade != null && (isNaN(grade) || grade < 0 || grade > 10)) {
      return NextResponse.json({ error: "Nota debe ser entre 0 y 10" }, { status: 400 });
    }

    // Verify the assignment belongs to this teacher
    const [assg] = await db
      .select({ teacherId: assignments.teacherId, cursoId: assignments.cursoId })
      .from(assignments)
      .where(eq(assignments.id, assignmentId))
      .limit(1);

    if (!assg || assg.teacherId !== user.id) {
      return NextResponse.json({ error: "No autorizado o tarea no encontrada" }, { status: 403 });
    }

    if (submissionId) {
      // Grade existing submission
      const [row] = await db
        .select({ id: assignmentSubmissions.id })
        .from(assignmentSubmissions)
        .where(and(
          eq(assignmentSubmissions.id, submissionId),
          eq(assignmentSubmissions.assignmentId, assignmentId)
        ))
        .limit(1);

      if (!row) {
        return NextResponse.json({ error: "Entrega no encontrada" }, { status: 404 });
      }

      await db
        .update(assignmentSubmissions)
        .set({
          grade,
          feedback: feedback || null,
          status: grade != null ? "graded" : "submitted",
        } as any)
        .where(eq(assignmentSubmissions.id, submissionId));
    } else if (studentId) {
      // Grade student without prior submission (manual grading)
      if (assg.cursoId) {
        const enrolled = await db
          .select({ id: cursoEstudiantes.id })
          .from(cursoEstudiantes)
          .where(and(
            eq(cursoEstudiantes.cursoId, assg.cursoId),
            eq(cursoEstudiantes.estudianteId, studentId)
          ))
          .limit(1);
        if (!enrolled.length) {
          return NextResponse.json({ error: "El estudiante no pertenece a este curso" }, { status: 400 });
        }
      }

      const [existing] = await db
        .select({ id: assignmentSubmissions.id })
        .from(assignmentSubmissions)
        .where(and(
          eq(assignmentSubmissions.assignmentId, assignmentId),
          eq(assignmentSubmissions.studentId, studentId)
        ))
        .limit(1);

      if (existing) {
        await db
          .update(assignmentSubmissions)
          .set({
            grade,
            feedback: feedback || null,
            status: grade != null ? "graded" : "submitted",
          } as any)
          .where(eq(assignmentSubmissions.id, existing.id));
      } else {
        await db
          .insert(assignmentSubmissions)
          .values({
            assignmentId,
            studentId,
            status: grade != null ? "graded" : "submitted",
            grade,
            feedback: feedback || "Nota registrada manualmente.",
          } as any);
      }
    }

    return NextResponse.json({ success: true, graded: true });
  } catch (error) {
    console.error("PUT /api/assignments/[id]/grade error:", error);
    return NextResponse.json({ error: "Error al calificar" }, { status: 500 });
  }
}
