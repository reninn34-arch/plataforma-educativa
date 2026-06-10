import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  cuestionarios, cuestionarioPreguntas, subjects, cursos,
  cursoEstudiantes, users,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "student") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const [cuestionario] = await db
      .select({
        id: cuestionarios.id,
        title: cuestionarios.title,
        description: cuestionarios.description,
        subjectName: subjects.name,
        subjectEmoji: subjects.emoji,
        subjectSlug: subjects.slug,
        cursoNombre: cursos.nombre,
        cursoNivel: cursos.nivel,
        teacherName: users.fullName,
        createdAt: cuestionarios.createdAt,
      })
      .from(cuestionarios)
      .innerJoin(subjects, eq(subjects.id, cuestionarios.subjectId))
      .leftJoin(cursos, eq(cursos.id, cuestionarios.cursoId))
      .innerJoin(users, eq(users.id, cuestionarios.teacherId))
      .where(eq(cuestionarios.id, parseInt(id)))
      .limit(1);

    if (!cuestionario) {
      return NextResponse.json({ error: "Cuestionario no encontrado" }, { status: 404 });
    }

    const enrolledCourses = await db
      .select({ cursoId: cursoEstudiantes.cursoId })
      .from(cursoEstudiantes)
      .where(eq(cursoEstudiantes.estudianteId, user.id));
    const courseIds = enrolledCourses.map(c => c.cursoId);

    const preguntas = await db
      .select({
        id: cuestionarioPreguntas.id,
        type: cuestionarioPreguntas.type,
        question: cuestionarioPreguntas.question,
        options: cuestionarioPreguntas.options,
        correctIndex: cuestionarioPreguntas.correctIndex,
        explanation: cuestionarioPreguntas.explanation,
        orderIndex: cuestionarioPreguntas.orderIndex,
      })
      .from(cuestionarioPreguntas)
      .where(eq(cuestionarioPreguntas.cuestionarioId, parseInt(id)))
      .orderBy(cuestionarioPreguntas.orderIndex);

    return NextResponse.json({ cuestionario, preguntas });
  } catch (error) {
    console.error("[cuestionario detail] error:", error);
    return NextResponse.json({ error: "Error al cargar cuestionario" }, { status: 500 });
  }
}
