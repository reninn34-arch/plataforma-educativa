import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cuestionarios, cuestionarioPreguntas, subjects, cursos, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "Solo docentes" }, { status: 403 });
  }

  try {
    const { id } = await params;

    const [existing] = await db
      .select({ id: cuestionarios.id, teacherId: cuestionarios.teacherId })
      .from(cuestionarios)
      .where(eq(cuestionarios.id, parseInt(id)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Cuestionario no encontrado" }, { status: 404 });
    }

    if (existing.teacherId !== user.id) {
      return NextResponse.json({ error: "No tienes permiso para editar este cuestionario" }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, questions } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "El titulo es requerido" }, { status: 400 });
    }

    await db.update(cuestionarios)
      .set({
        title: title.trim(),
        description: description?.trim() || null,
      } as any)
      .where(eq(cuestionarios.id, parseInt(id)));

    await db
      .delete(cuestionarioPreguntas)
      .where(eq(cuestionarioPreguntas.cuestionarioId, parseInt(id)));

    if (questions && Array.isArray(questions)) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const qType = q.virtualType === "completar" ? "completar" : "mcq";
        await db.insert(cuestionarioPreguntas).values({
          cuestionarioId: parseInt(id),
          type: qType,
          question: q.question || "",
          options: q.options || [],
          correctIndex: q.correctIndex ?? 0,
          explanation: q.explanation || "",
          points: q.points || 1,
          orderIndex: i,
        } as any);
      }
    }

    return NextResponse.json({
      success: true,
      mensaje: "Cuestionario actualizado exitosamente",
      preguntaCount: questions?.length || 0,
    });
  } catch (error) {
    console.error("[teacher cuestionario update] error:", error);
    return NextResponse.json({ error: "Error al actualizar cuestionario" }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const { id } = await params;

    const [cuestionario] = await db
      .select({
        id: cuestionarios.id,
        teacherId: cuestionarios.teacherId,
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

    if (user.role !== "admin" && cuestionario.teacherId !== user.id) {
      return NextResponse.json({ error: "No tienes permiso para ver este cuestionario" }, { status: 403 });
    }

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
    console.error("[teacher cuestionario detail] error:", error);
    return NextResponse.json({ error: "Error al cargar cuestionario" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "Solo docentes" }, { status: 403 });
  }

  try {
    const { id } = await params;

    const [existing] = await db
      .select({ id: cuestionarios.id, teacherId: cuestionarios.teacherId })
      .from(cuestionarios)
      .where(eq(cuestionarios.id, parseInt(id)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Cuestionario no encontrado" }, { status: 404 });
    }

    if (existing.teacherId !== user.id) {
      return NextResponse.json({ error: "No tienes permiso para eliminar este cuestionario" }, { status: 403 });
    }

    await db
      .delete(cuestionarioPreguntas)
      .where(eq(cuestionarioPreguntas.cuestionarioId, parseInt(id)));

    await db
      .delete(cuestionarios)
      .where(eq(cuestionarios.id, parseInt(id)));

    return NextResponse.json({ success: true, mensaje: "Cuestionario eliminado" });
  } catch (error) {
    console.error("[teacher cuestionario delete] error:", error);
    return NextResponse.json({ error: "Error al eliminar cuestionario" }, { status: 500 });
  }
}
