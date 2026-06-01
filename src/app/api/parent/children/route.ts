import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parentStudents, users, cursoEstudiantes, cursos, progress, subjects, assignmentSubmissions, assignments, cursoProfesores } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const parent = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
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

    // Batch 1: all student courses for all children
    const studentIds = links.map(l => l.studentId);
    const allStudentCourses = await db
      .select({ studentId: cursoEstudiantes.estudianteId, cursoId: cursos.id, cursoNombre: cursos.nombre })
      .from(cursoEstudiantes)
      .innerJoin(cursos, eq(cursoEstudiantes.cursoId, cursos.id))
      .where(inArray(cursoEstudiantes.estudianteId, studentIds));

    // Batch 2: all subject ids for all courses
    const courseIds = [...new Set(allStudentCourses.map(c => c.cursoId))];
    const allCourseSubjects = courseIds.length > 0 ? await db
      .select({ cursoId: cursoProfesores.cursoId, subjectId: cursoProfesores.subjectId })
      .from(cursoProfesores)
      .where(inArray(cursoProfesores.cursoId, courseIds)) : [];

    // Batch 3: all progress for all students
    const subjectIds = [...new Set(allCourseSubjects.map(s => s.subjectId))];
    const allProgress = studentIds.length > 0 ? await db
      .select({ userId: progress.userId, subjectId: progress.subjectId, percentage: progress.percentage })
      .from(progress)
      .where(inArray(progress.userId, studentIds)) : [];

    // Batch 4: all grades for all students
    const allGrades = studentIds.length > 0 ? await db
      .select({ studentId: assignmentSubmissions.studentId, subjectEmoji: subjects.emoji, subjectName: subjects.name, grade: assignmentSubmissions.grade })
      .from(assignmentSubmissions)
      .innerJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id))
      .innerJoin(subjects, eq(assignments.subjectId, subjects.id))
      .where(inArray(assignmentSubmissions.studentId, studentIds)) : [];

    // Group by studentId
    const coursesByStudent = new Map<number, typeof allStudentCourses>();
    for (const c of allStudentCourses) {
      if (!coursesByStudent.has(c.studentId)) coursesByStudent.set(c.studentId, []);
      coursesByStudent.get(c.studentId)!.push(c);
    }
    const subjectsByCourse = new Map<number, number[]>();
    for (const s of allCourseSubjects) {
      if (!subjectsByCourse.has(s.cursoId)) subjectsByCourse.set(s.cursoId, []);
      subjectsByCourse.get(s.cursoId)!.push(s.subjectId);
    }
    const progressByStudent = new Map<number, typeof allProgress>();
    for (const p of allProgress) {
      if (!progressByStudent.has(p.userId)) progressByStudent.set(p.userId, []);
      progressByStudent.get(p.userId)!.push(p);
    }
    const gradesByStudent = new Map<number, typeof allGrades>();
    for (const g of allGrades) {
      if (!gradesByStudent.has(g.studentId)) gradesByStudent.set(g.studentId, []);
      gradesByStudent.get(g.studentId)!.push(g);
    }

    const children = links.map(link => {
      const studentCourses = coursesByStudent.get(link.studentId) || [];

      const coursesWithProgress = studentCourses.map(c => {
        const sIds = subjectsByCourse.get(c.cursoId) || [];
        const stProgress = progressByStudent.get(link.studentId) || [];
        const relevant = stProgress.filter(p => sIds.includes(p.subjectId));
        const avg = relevant.length > 0
          ? Math.round(relevant.reduce((a, b) => a + b.percentage, 0) / relevant.length)
          : 0;
        return { ...c, progress: avg };
      });

      const grades = gradesByStudent.get(link.studentId) || [];
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
    });

    return NextResponse.json({ children });
  } catch (error) {
    console.error("Parent children error:", error);
    return NextResponse.json({ error: "Error al cargar datos" }, { status: 500 });
  }
}
