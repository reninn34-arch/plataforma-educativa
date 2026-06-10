import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cuestionarios, cuestionarioPreguntas, subjects, cursos, cursoEstudiantes } from "@/lib/db/schema";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "student") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const enrolledCourses = await db
      .select({ cursoId: cursoEstudiantes.cursoId })
      .from(cursoEstudiantes)
      .where(eq(cursoEstudiantes.estudianteId, user.id));

    const courseIds = enrolledCourses.map(c => c.cursoId);
    if (courseIds.length === 0) {
      return NextResponse.json({ cuestionarios: [] });
    }

    const list = await db
      .select({
        id: cuestionarios.id,
        title: cuestionarios.title,
        description: cuestionarios.description,
        subjectName: subjects.name,
        subjectEmoji: subjects.emoji,
        subjectSlug: subjects.slug,
        cursoNombre: cursos.nombre,
        cursoNivel: cursos.nivel,
        createdAt: cuestionarios.createdAt,
        teacherId: cuestionarios.teacherId,
      })
      .from(cuestionarios)
      .innerJoin(subjects, eq(subjects.id, cuestionarios.subjectId))
      .leftJoin(cursos, eq(cursos.id, cuestionarios.cursoId))
      .where(inArray(cuestionarios.cursoId, courseIds))
      .orderBy(desc(cuestionarios.createdAt));

    const cuestionariosWithCount = await Promise.all(
      list.map(async (c) => {
        const [countResult] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(cuestionarioPreguntas)
          .where(eq(cuestionarioPreguntas.cuestionarioId, c.id));
        return { ...c, preguntaCount: countResult?.count || 0 };
      })
    );

    return NextResponse.json({ cuestionarios: cuestionariosWithCount });
  } catch (error) {
    console.error("[cuestionarios] error:", error);
    return NextResponse.json({ error: "Error al cargar cuestionarios" }, { status: 500 });
  }
}
