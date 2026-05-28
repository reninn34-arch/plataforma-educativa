import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignments, assignmentSubmissions, subjects } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user || user.role !== "student") return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
  const data = await db
    .select({
      id: assignmentSubmissions.id,
      assignmentId: assignments.id,
      assignmentTitle: assignments.title,
      subjectName: subjects.name,
      subjectEmoji: subjects.emoji,
      trimester: assignments.trimester,
      grade: assignmentSubmissions.grade,
      feedback: assignmentSubmissions.feedback,
      status: assignmentSubmissions.status,
      submittedAt: assignmentSubmissions.submittedAt,
    })
    .from(assignmentSubmissions)
    .leftJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id))
    .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
    .where(eq(assignmentSubmissions.studentId, user.id))
    .orderBy(desc(assignmentSubmissions.submittedAt));

  const graded = data.filter(r => r.grade !== null);
  const pending = data.filter(r => r.status === "submitted" && r.grade === null);
  const notSubmitted = data.filter(r => r.status === "pending");

  const subjectMap = new Map<string, { name: string; emoji: string; t1: number[]; t2: number[]; t3: number[]; all: number[] }>();
  graded.forEach(row => {
    const key = row.subjectName || "Sin materia";
    if (!subjectMap.has(key)) subjectMap.set(key, { name: row.subjectName || "", emoji: row.subjectEmoji || "", t1: [], t2: [], t3: [], all: [] });
    const s = subjectMap.get(key)!;
    if (row.grade !== null) {
      s.all.push(row.grade);
      if (row.trimester === 1) s.t1.push(row.grade);
      if (row.trimester === 2) s.t2.push(row.grade);
      if (row.trimester === 3) s.t3.push(row.grade);
    }
  });

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  const summary = Array.from(subjectMap.entries()).map(([_, s]) => ({
    subjectName: s.name,
    subjectEmoji: s.emoji,
    t1Avg: avg(s.t1),
    t2Avg: avg(s.t2),
    t3Avg: avg(s.t3),
    yearlyAvg: (() => {
      const t1 = avg(s.t1);
      const t2 = avg(s.t2);
      const t3 = avg(s.t3);
      const t1Val = s.t1.length > 0 ? (t1 ?? 0) : null;
      const t2Val = s.t2.length > 0 ? (t2 ?? 0) : null;
      const t3Val = s.t3.length > 0 ? (t3 ?? 0) : null;
      const valid = [t1Val, t2Val, t3Val].filter(t => t !== null);
      return valid.length > 0 ? Math.round(((t1Val ?? 0) + (t2Val ?? 0) + (t3Val ?? 0)) / 3 * 100) / 100 : null;
    })(),
    totalGraded: s.all.length,
  }));

  const allAvgs = summary.flatMap(g => [g.t1Avg, g.t2Avg, g.t3Avg].filter(v => v !== null));
  const generalAvg = allAvgs.length > 0
    ? Math.round((allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length) * 100) / 100
    : null;

  return NextResponse.json({
    graded,
    pending,
    notSubmittedCount: notSubmitted.length,
    summary,
    generalAvg,
  });
  } catch {
    return NextResponse.json({ error: "Error al cargar calificaciones" }, { status: 500 });
  }
}
