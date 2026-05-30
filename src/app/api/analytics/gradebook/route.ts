import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignments, assignmentSubmissions, subjects, users, cursos, periodosLectivos } from "@/lib/db/schema";
import { eq, and, desc, asc, inArray } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { getTeacherCourseIds } from "@/lib/course-helpers";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "Solo docentes" }, { status: 403 });
  }

  const trimester = parseInt(request.nextUrl.searchParams.get("trimester") || "0");
  const cursoIdParam = request.nextUrl.searchParams.get("cursoId");
  const periodoIdParam = request.nextUrl.searchParams.get("periodoId");

  try {
    const allIds = await getTeacherCourseIds(user.id);

    let targetCursoIds: number[];
    if (cursoIdParam) {
      const cid = parseInt(cursoIdParam);
      if (!allIds.includes(cid)) {
        return NextResponse.json({ error: "No tienes acceso a este curso" }, { status: 403 });
      }
      targetCursoIds = [cid];
    } else {
      targetCursoIds = allIds;
    }

    const conditions: any[] = [eq(assignments.teacherId, user.id)];
    if (trimester > 0) conditions.push(eq(assignments.trimester, trimester));
    if (targetCursoIds.length > 0) {
      conditions.push(inArray(assignments.cursoId, targetCursoIds));
    }

    if (periodoIdParam) {
      conditions.push(eq(assignments.periodoLectivoId, parseInt(periodoIdParam)));
    } else {
      const [activePeriod] = await db
        .select({ id: periodosLectivos.id })
        .from(periodosLectivos)
        .where(eq(periodosLectivos.activo, true))
        .limit(1);
      if (activePeriod) {
        conditions.push(eq(assignments.periodoLectivoId, activePeriod.id));
      }
    }

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
        puntos: assignments.puntos,
        cursoId: assignments.cursoId,
        cursoNombre: cursos.nombre,
      })
      .from(assignmentSubmissions)
      .leftJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id))
      .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
      .leftJoin(users, eq(assignmentSubmissions.studentId, users.id))
      .leftJoin(cursos, eq(assignments.cursoId, cursos.id))
      .where(and(...conditions))
      .orderBy(desc(users.fullName), asc(subjects.name));

    const studentMap = new Map<number, {
      studentId: number;
      studentName: string;
      studentCedula: string;
      studentCursoNombre: string;
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
          studentCursoNombre: row.cursoNombre || "",
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
          t1Puntos: [],
          t2Puntos: [],
          t3Puntos: [],
        } as any);
      }

      if (row.grade !== null && row.grade !== undefined && row.subjectId) {
        const subj = student.subjects.get(row.subjectId)! as any;
        subj.grades.push(row.grade);
        const pt = row.puntos || 10;
        if (row.trimester === 1) { subj.t1Grades.push(row.grade); subj.t1Puntos.push(pt); }
        if (row.trimester === 2) { subj.t2Grades.push(row.grade); subj.t2Puntos.push(pt); }
        if (row.trimester === 3) { subj.t3Grades.push(row.grade); subj.t3Puntos.push(pt); }
      }
    }

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const weightedAvg = (grades: number[], puntos: number[]) => {
      if (grades.length === 0) return null;
      const totalPts = puntos.reduce((a, b) => a + b, 0);
      if (totalPts === 0) return null;
      const total = grades.reduce((sum, g, i) => sum + g * puntos[i], 0);
      return Math.round((total / totalPts) * 100) / 100;
    };

    const gradebook = Array.from(studentMap.values()).map(s => ({
      studentId: s.studentId,
      studentName: s.studentName,
      studentCedula: s.studentCedula,
      studentCursoNombre: s.studentCursoNombre,
      subjects: Array.from(s.subjects.values()).map((subj: any) => {
        const allPts = [...(subj.t1Puntos || []), ...(subj.t2Puntos || []), ...(subj.t3Puntos || [])];
        const allGrades = subj.grades;
        return {
          subjectId: subj.subjectId,
          subjectName: subj.subjectName,
          subjectEmoji: subj.subjectEmoji,
          t1Avg: weightedAvg(subj.t1Grades, subj.t1Puntos || []),
          t2Avg: weightedAvg(subj.t2Grades, subj.t2Puntos || []),
          t3Avg: weightedAvg(subj.t3Grades, subj.t3Puntos || []),
          yearlyAvg: (() => {
            const t1 = weightedAvg(subj.t1Grades, subj.t1Puntos || []);
            const t2 = weightedAvg(subj.t2Grades, subj.t2Puntos || []);
            const t3 = weightedAvg(subj.t3Grades, subj.t3Puntos || []);
            const vals = [t1, t2, t3].filter(v => v !== null);
            if (vals.length === 0) return null;
            return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
          })(),
          totalGrades: subj.grades.length,
          overallAvg: weightedAvg(subj.grades, allPts),
        };
      }),
    }));

    return NextResponse.json({ gradebook });
  } catch (error) {
    console.error("Gradebook error:", error);
    return NextResponse.json({ error: "Error al cargar calificaciones" }, { status: 500 });
  }
}
