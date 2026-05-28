import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignments, assignmentSubmissions, subjects, users } from "@/lib/db/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "Solo docentes" }, { status: 403 });
  }

  const trimester = parseInt(request.nextUrl.searchParams.get("trimester") || "0");

  try {
    // Get all submissions with grades
    const conditions: any[] = [eq(assignments.teacherId, user.id)];
    if (trimester > 0) conditions.push(eq(assignments.trimester, trimester));

    const data = await db
      .select({
        submissionId: assignmentSubmissions.id,
        studentId: assignmentSubmissions.studentId,
        studentName: users.fullName,
        studentCedula: users.cedula,
        assignmentId: assignments.id,
        assignmentTitle: assignments.title,
        subjectId: assignments.subjectId,
        subjectName: subjects.name,
        subjectEmoji: subjects.emoji,
        trimester: assignments.trimester,
        grade: assignmentSubmissions.grade,
        status: assignmentSubmissions.status,
        submittedAt: assignmentSubmissions.submittedAt,
      })
      .from(assignmentSubmissions)
      .leftJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id))
      .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
      .leftJoin(users, eq(assignmentSubmissions.studentId, users.id))
      .where(and(...conditions))
      .orderBy(desc(users.fullName), asc(subjects.name));

    // Group by student → subject → grades + averages
    const studentMap = new Map<number, {
      studentId: number;
      studentName: string;
      studentCedula: string;
      subjects: Map<number, {
        subjectId: number;
        subjectName: string;
        subjectEmoji: string;
        grades: number[];
        t1Grades: number[];
        t2Grades: number[];
        t3Grades: number[];
      }>;
    }>();

    for (const row of data) {
      if (!row.studentId) continue;

      if (!studentMap.has(row.studentId)) {
        studentMap.set(row.studentId, {
          studentId: row.studentId,
          studentName: row.studentName || "",
          studentCedula: row.studentCedula || "",
          subjects: new Map(),
        });
      }

      const student = studentMap.get(row.studentId)!;

      if (row.subjectId && !student.subjects.has(row.subjectId)) {
        student.subjects.set(row.subjectId, {
          subjectId: row.subjectId,
          subjectName: row.subjectName || "",
          subjectEmoji: row.subjectEmoji || "",
          grades: [],
          t1Grades: [],
          t2Grades: [],
          t3Grades: [],
        });
      }

      if (row.grade !== null && row.grade !== undefined && row.subjectId) {
        const subj = student.subjects.get(row.subjectId)!;
        subj.grades.push(row.grade);
        if (row.trimester === 1) subj.t1Grades.push(row.grade);
        if (row.trimester === 2) subj.t2Grades.push(row.grade);
        if (row.trimester === 3) subj.t3Grades.push(row.grade);
      }
    }

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

    const gradebook = Array.from(studentMap.values()).map(s => ({
      studentId: s.studentId,
      studentName: s.studentName,
      studentCedula: s.studentCedula,
      subjects: Array.from(s.subjects.values()).map(subj => ({
        subjectId: subj.subjectId,
        subjectName: subj.subjectName,
        subjectEmoji: subj.subjectEmoji,
        // Trimester averages
        t1Avg: avg(subj.t1Grades),
        t2Avg: avg(subj.t2Grades),
        t3Avg: avg(subj.t3Grades),
        // Yearly average formula: (T1 + T2 + T3) / 3
        // If a trimester has no grades, use 0
        yearlyAvg: (() => {
          const t1 = avg(subj.t1Grades);
          const t2 = avg(subj.t2Grades);
          const t3 = avg(subj.t3Grades);
          const t1Val = subj.t1Grades.length > 0 ? (t1 ?? 0) : null;
          const t2Val = subj.t2Grades.length > 0 ? (t2 ?? 0) : null;
          const t3Val = subj.t3Grades.length > 0 ? (t3 ?? 0) : null;
          const valid = [t1Val, t2Val, t3Val].filter(t => t !== null);
          if (valid.length === 0) return null;
          return Math.round(((t1Val ?? 0) + (t2Val ?? 0) + (t3Val ?? 0)) / 3 * 100) / 100;
        })(),
        totalGrades: subj.grades.length,
        overallAvg: avg(subj.grades),
      })),
    }));

    return NextResponse.json({ gradebook });
  } catch (error) {
    console.error("Gradebook error:", error);
    return NextResponse.json({ error: "Error al cargar calificaciones" }, { status: 500 });
  }
}
