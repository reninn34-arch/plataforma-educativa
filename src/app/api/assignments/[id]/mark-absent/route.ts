import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignments, assignmentSubmissions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get("atlas-edu-token")?.value;
    const user = token ? await verifyToken(token) : null;
    if (!user || user.role !== "teacher") {
      return NextResponse.json({ error: "Solo docentes" }, { status: 403 });
    }

    const { id } = await params;
    const assignmentId = parseInt(id);
    const { studentId } = await request.json();

    if (!studentId) {
      return NextResponse.json({ error: "studentId requerido" }, { status: 400 });
    }

    // Verify teacher owns the assignment
    const [assg] = await db
      .select({ teacherId: assignments.teacherId })
      .from(assignments)
      .where(eq(assignments.id, assignmentId))
      .limit(1);

    if (!assg || assg.teacherId !== user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Check if student already has a submission
    const [existing] = await db
      .select({ id: assignmentSubmissions.id })
      .from(assignmentSubmissions)
      .where(and(
        eq(assignmentSubmissions.assignmentId, assignmentId),
        eq(assignmentSubmissions.studentId, studentId)
      ))
      .limit(1);

    if (existing) {
      return NextResponse.json({ error: "El estudiante ya tiene una entrega" }, { status: 400 });
    }

    const [submission] = await db
      .insert(assignmentSubmissions)
      .values({
        assignmentId,
        studentId,
        status: "graded",
        grade: 0,
        feedback: "No entregó",
      } as any)
      .returning();

    return NextResponse.json({ success: true, submission });
  } catch (error) {
    console.error("POST /api/assignments/[id]/mark-absent error:", error);
    return NextResponse.json({ error: "Error al marcar como no entregado" }, { status: 500 });
  }
}
