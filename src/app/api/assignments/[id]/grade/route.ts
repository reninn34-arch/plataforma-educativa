import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignments, assignmentSubmissions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get("atlas-edu-token")?.value;
    const user = token ? await verifyToken(token) : null;
    if (!user || user.role !== "teacher") {
      return NextResponse.json({ error: "Solo docentes pueden calificar" }, { status: 403 });
    }

    const { id } = await params;
    const assignmentId = parseInt(id);
    const { submissionId, grade: rawGrade, feedback } = await request.json();

    if (!submissionId) {
      return NextResponse.json({ error: "submissionId requerido" }, { status: 400 });
    }

    const grade = rawGrade != null ? Math.round(rawGrade) : null;
    if (grade != null && (isNaN(grade) || grade < 0 || grade > 10)) {
      return NextResponse.json({ error: "Nota debe ser entre 0 y 10" }, { status: 400 });
    }

    // Verify the assignment belongs to this teacher and submission belongs to assignment
    const [row] = await db
      .select({
        teacherId: assignments.teacherId,
        subId: assignmentSubmissions.id,
      })
      .from(assignmentSubmissions)
      .leftJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id))
      .where(and(
        eq(assignmentSubmissions.id, submissionId),
        eq(assignments.id, assignmentId),
      ))
      .limit(1);

    if (!row || row.teacherId !== user.id) {
      return NextResponse.json({ error: "No autorizado o tarea no encontrada" }, { status: 403 });
    }

    await db
      .update(assignmentSubmissions)
      .set({
        grade,
        feedback: feedback || null,
        status: grade != null ? "graded" : "submitted",
      } as any)
      .where(eq(assignmentSubmissions.id, submissionId));

    return NextResponse.json({ success: true, graded: true });
  } catch (error) {
    console.error("PUT /api/assignments/[id]/grade error:", error);
    return NextResponse.json({ error: "Error al calificar" }, { status: 500 });
  }
}
