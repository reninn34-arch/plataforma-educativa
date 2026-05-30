import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cursos, cursoEstudiantes, cursoProfesores, users, subjects } from "@/lib/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { getTeacherCourseIds } from "@/lib/course-helpers";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const teacher = token ? await verifyToken(token) : null;
  if (!teacher || teacher.role !== "teacher") {
    return NextResponse.json({ error: "Solo profesores" }, { status: 403 });
  }

  try {
    const allIdsSet = await getTeacherCourseIds(teacher.id);
    const allIds = new Set(allIdsSet);

    if (allIds.size === 0) {
      return NextResponse.json({ cursos: [] });
    }

    const idsArray = [...allIds];

    const data = await db
      .select({
        id: cursos.id,
        nombre: cursos.nombre,
        nivel: cursos.nivel,
        profesorId: cursos.profesorId,
        profesorNombre: users.fullName,
        activo: cursos.activo,
        createdAt: cursos.createdAt,
        studentCount: sql<number>`count(DISTINCT ${cursoEstudiantes.estudianteId})`.mapWith(Number),
      })
      .from(cursos)
      .leftJoin(users, eq(cursos.profesorId, users.id))
      .leftJoin(cursoEstudiantes, eq(cursoEstudiantes.cursoId, cursos.id))
      .where(inArray(cursos.id, idsArray))
      .groupBy(cursos.id, users.fullName);

    const cursosWithTeachers = await Promise.all(
      data.map(async (c) => {
        const mySubjects = await db
          .select({
            teacherId: cursoProfesores.teacherId,
            teacherName: users.fullName,
            subjectId: cursoProfesores.subjectId,
            subjectName: subjects.name,
            subjectEmoji: subjects.emoji,
          })
          .from(cursoProfesores)
          .innerJoin(users, eq(cursoProfesores.teacherId, users.id))
          .innerJoin(subjects, eq(cursoProfesores.subjectId, subjects.id))
          .where(eq(cursoProfesores.cursoId, c.id));

        return {
          ...c,
          teacherSubjects: mySubjects,
          isTutor: c.profesorId === teacher.id,
          mySubjects: mySubjects.filter(ts => ts.teacherId === teacher.id),
        };
      })
    );

    return NextResponse.json({ cursos: cursosWithTeachers });
  } catch (error) {
    console.error("Teacher courses error:", error);
    return NextResponse.json({ error: "Error al cargar cursos" }, { status: 500 });
  }
}
