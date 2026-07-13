/**
 * @swagger
 * /api/messages/course:
 *   post:
 *     summary: Enviar mensaje a un curso
 *     description: Envía un mensaje a todos los estudiantes activos de un curso. Solo docentes y administradores.
 *     tags: [Mensajería]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cursoId, message]
 *             properties:
 *               cursoId:
 *                 type: integer
 *                 description: ID del curso
 *               message:
 *                 type: string
 *                 description: Contenido del mensaje
 *     responses:
 *       200:
 *         description: Mensaje enviado a los estudiantes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 enviados:
 *                   type: integer
 *                 curso:
 *                   type: string
 *                 mensaje:
 *                   type: string
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Acción no permitida para este rol
 *       404:
 *         description: Curso no encontrado
 *       500:
 *         description: Error interno
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { directMessages, users, cursos, cursoEstudiantes, cursoProfesores } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { notifyStudentsInCourse } from "@/lib/notifications";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (user.role !== "teacher" && user.role !== "admin") {
    return NextResponse.json({ error: "Solo docentes pueden enviar mensajes a cursos" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { cursoId, message } = body;

    if (!cursoId || !message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ error: "cursoId y message son requeridos" }, { status: 400 });
    }

    const [course] = await db
      .select({ id: cursos.id, nombre: cursos.nombre })
      .from(cursos)
      .where(eq(cursos.id, cursoId))
      .limit(1);

    if (!course) return NextResponse.json({ error: "Curso no encontrado" }, { status: 404 });

    const isOwner = await db
      .select({ id: cursos.id })
      .from(cursos)
      .where(and(eq(cursos.id, cursoId), eq(cursos.profesorId, user.id)))
      .limit(1);

    const isAssignedTeacher = await db
      .select({ id: cursoProfesores.id })
      .from(cursoProfesores)
      .where(and(eq(cursoProfesores.cursoId, cursoId), eq(cursoProfesores.teacherId, user.id)))
      .limit(1);

    if (user.role !== "admin" && !isOwner.length && !isAssignedTeacher.length) {
      return NextResponse.json({ error: "No tienes acceso a este curso" }, { status: 403 });
    }

    const students = await db
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .innerJoin(cursoEstudiantes, eq(cursoEstudiantes.estudianteId, users.id))
      .where(and(eq(cursoEstudiantes.cursoId, cursoId), eq(users.activo, true)));

    if (students.length === 0) {
      return NextResponse.json({ error: "No hay estudiantes activos en este curso" }, { status: 400 });
    }

    let sent = 0;
    for (const s of students) {
      await db.insert(directMessages).values({
        senderId: user.id,
        receiverId: s.id,
        content: message.trim(),
      });
      sent++;
    }

    await notifyStudentsInCourse({
      cursoId,
      type: "message",
      title: `Nuevo mensaje de ${user.fullName || "tu profesor"}`,
      message: message.trim().slice(0, 120),
      excludeUserId: user.id,
    });

    return NextResponse.json({
      enviados: sent,
      curso: course.nombre,
      mensaje: `Mensaje enviado a ${sent} estudiantes de ${course.nombre}.`,
    });
  } catch {
    return NextResponse.json({ error: "Error al enviar mensaje al curso" }, { status: 500 });
  }
}
