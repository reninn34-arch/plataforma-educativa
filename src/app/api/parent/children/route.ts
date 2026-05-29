import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parentStudents, users, cursoEstudiantes, cursos, progress, subjects, assignmentSubmissions, assignments, cursoProfesores } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const parent = token ? await verifyToken(token) : null;
  if (!parent || parent.role !== "parent") {
    return NextResponse.json({ error: "Solo padres" }, { status: 403 });
  }

  try {
    const links = await db
      .select({
        studentId: parentStudents.studentId,
        studentName: users.fullName,
        studentCedula: users.cedula,
      })
      .from(parentStudents)
      .innerJoin(users, eq(parentStudents.studentId, users.id))
      .where(eq(parentStudents.parentId, parent.id));

    if (links.length === 0) {
      return NextResponse.json({ children: [] });
    }

    const children = await Promise.all(links.map(async (link) => {
      const studentCourses = await db
        .select({
          cursoId: cursos.id,
          cursoNombre: cursos.nombre,
        })
        .from(cursoEstudiantes)
        .innerJoin(cursos, eq(cursoEstudiantes.cursoId, cursos.id))
        .where(eq(cursoEstudiantes.estudianteId, link.studentId));

      const coursesWithProgress = await Promise.all(studentCourses.map(async (c) => {
        const subjectIds = await db
          .select({ subjectId: cursoProfesores.subjectId })
          .from(cursoProfesores)
          .where(eq(cursoProfesores.cursoId, c.cursoId));

        const sIds = subjectIds.map(s => s.subjectId);
        const prog = sIds.length > 0
          ? await db
              .select({ percentage: progress.percentage })
              .from(progress)
              .where(and(eq(progress.userId, link.studentId), inArray(progress.subjectId, sIds)))
          : await db
              .select({ percentage: progress.percentage })
              .from(progress)
              .where(eq(progress.userId, link.studentId));

        const avg = prog.length > 0
          ? Math.round(prog.reduce((a, b) => a + b.percentage, 0) / prog.length)
          : 0;

        return { ...c, progress: avg };
      }));

      const grades = await db
        .select({
          subjectEmoji: subjects.emoji,
          subjectName: subjects.name,
          grade: assignmentSubmissions.grade,
        })
        .from(assignmentSubmissions)
        .innerJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id))
        .innerJoin(subjects, eq(assignments.subjectId, subjects.id))
        .where(eq(assignmentSubmissions.studentId, link.studentId));

      const gradeBySubject = new Map<string, { emoji: string; grades: number[] }>();
      for (const g of grades) {
        if (!g.grade) continue;
        if (!gradeBySubject.has(g.subjectName)) {
          gradeBySubject.set(g.subjectName, { emoji: g.subjectEmoji, grades: [] });
        }
        gradeBySubject.get(g.subjectName)!.grades.push(g.grade);
      }

      const gradeSummaries = Array.from(gradeBySubject.entries()).map(([name, data]) => ({
        name, emoji: data.emoji,
        value: data.grades.length > 0 ? data.grades.reduce((a, b) => a + b, 0) / data.grades.length : null,
      }));

      return {
        studentId: link.studentId,
        studentName: link.studentName,
        studentCedula: link.studentCedula,
        cursos: coursesWithProgress,
        grades: gradeSummaries,
      };
    }));

    return NextResponse.json({ children });
  } catch (error) {
    console.error("Parent children error:", error);
    return NextResponse.json({ error: "Error al cargar datos" }, { status: 500 });
  }
}
