import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignmentSubmissions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "Solo docentes pueden calificar" }, { status: 403 });
  }

  const { id } = await params;
  const { submissionId, grade, feedback } = await request.json();

  if (!submissionId) {
    return NextResponse.json({ error: "submissionId requerido" }, { status: 400 });
  }

  if (grade !== undefined && (grade < 0 || grade > 10)) {
    return NextResponse.json({ error: "Nota debe ser entre 0 y 10" }, { status: 400 });
  }

  await db
    .update(assignmentSubmissions)
    .set({
      grade: grade ?? null,
      feedback: feedback || null,
      status: grade !== undefined && grade !== null ? "graded" : "submitted",
    } as any)
    .where(eq(assignmentSubmissions.id, submissionId));

  return NextResponse.json({ success: true, graded: true });
}
