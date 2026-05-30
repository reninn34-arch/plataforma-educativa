import { db } from "@/lib/db";
import { cursos, cursoProfesores } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function getTeacherCourseIds(teacherId: number): Promise<number[]> {
  const mySubjectCourses = await db
    .select({ cursoId: cursoProfesores.cursoId })
    .from(cursoProfesores)
    .where(eq(cursoProfesores.teacherId, teacherId));

  const tutorCourses = await db
    .select({ id: cursos.id })
    .from(cursos)
    .where(eq(cursos.profesorId, teacherId));

  return [...new Set([
    ...mySubjectCourses.map(r => r.cursoId),
    ...tutorCourses.map(r => r.id),
  ])];
}

export async function teacherHasCourseAccess(
  teacherId: number,
  cursoId: number
): Promise<boolean> {
  const [isMember] = await db
    .select({ id: cursoProfesores.id })
    .from(cursoProfesores)
    .where(
      and(eq(cursoProfesores.cursoId, cursoId), eq(cursoProfesores.teacherId, teacherId))
    )
    .limit(1);

  if (isMember) return true;

  const [isTutor] = await db
    .select({ id: cursos.id })
    .from(cursos)
    .where(and(eq(cursos.id, cursoId), eq(cursos.profesorId, teacherId)))
    .limit(1);

  return !!isTutor;
}
