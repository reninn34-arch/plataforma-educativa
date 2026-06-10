import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  cuestionarios, cuestionarioPreguntas, subjects, cursos,
} from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { notifyStudentsInCourse } from "@/lib/notifications";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "Solo docentes" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { cursoId, subjectId, title, description, questions } = body;

    if (!subjectId || !title?.trim()) {
      return NextResponse.json({ error: "Materia y titulo son requeridos" }, { status: 400 });
    }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: "Debe incluir al menos una pregunta" }, { status: 400 });
    }

    const [cuestionario] = await db.insert(cuestionarios).values({
      teacherId: user.id,
      subjectId,
      cursoId: cursoId || null,
      title: title.trim(),
      description: description?.trim() || null,
      trimester: 1,
    } as any).returning();

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const qType = q.virtualType === "completar" ? "completar" : "mcq";
      await db.insert(cuestionarioPreguntas).values({
        cuestionarioId: cuestionario.id,
        type: qType,
        question: q.question || "",
        options: q.options || [],
        correctIndex: q.correctIndex ?? 0,
        explanation: q.explanation || "",
        points: q.points || 1,
        orderIndex: i,
      } as any);
    }

    if (cursoId) {
      await notifyStudentsInCourse({
        cursoId,
        type: "study_material",
        title: `Nuevo cuestionario de estudio: ${title.trim()}`,
        message: `Se ha publicado un cuestionario con ${questions.length} preguntas para que estudies.`,
        excludeUserId: user.id,
        link: `/student/cuestionarios/${cuestionario.id}`,
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      cuestionarioId: cuestionario.id,
      mensaje: `Cuestionario "${title.trim()}" creado exitosamente con ${questions.length} preguntas.`,
    }, { status: 201 });
  } catch (error) {
    console.error("[teacher cuestionario create] error:", error);
    return NextResponse.json({ error: "Error al crear cuestionario" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "Solo docentes" }, { status: 403 });
  }

  try {
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
      })
      .from(cuestionarios)
      .innerJoin(subjects, eq(subjects.id, cuestionarios.subjectId))
      .leftJoin(cursos, eq(cursos.id, cuestionarios.cursoId))
      .where(eq(cuestionarios.teacherId, user.id))
      .orderBy(desc(cuestionarios.createdAt));

    const withCount = await Promise.all(
      list.map(async (c) => {
        const [countResult] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(cuestionarioPreguntas)
          .where(eq(cuestionarioPreguntas.cuestionarioId, c.id));
        return { ...c, preguntaCount: countResult?.count || 0 };
      })
    );

    return NextResponse.json({ cuestionarios: withCount });
  } catch (error) {
    console.error("[teacher cuestionarios] error:", error);
    return NextResponse.json({ error: "Error al cargar cuestionarios" }, { status: 500 });
  }
}
