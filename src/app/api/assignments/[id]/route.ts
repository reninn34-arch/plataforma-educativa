/**
 * @swagger
 * /api/assignments/{id}:
 *   get:
 *     summary: Obtener tarea por ID
 *     description: Devuelve una tarea con sus preguntas y entregas. Los profesores ven todas las entregas; los estudiantes ven solo la suya.
 *     tags: [Tareas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: ID de la tarea
 *     responses:
 *       200:
 *         description: Detalle de la tarea
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 assignment:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     title: { type: string }
 *                     description: { type: string, nullable: true }
 *                     dueDate: { type: string, format: date-time, nullable: true }
 *                     createdAt: { type: string, format: date-time }
 *                     subjectName: { type: string }
 *                     subjectEmoji: { type: string }
 *                     subjectSlug: { type: string }
 *                     subjectId: { type: integer }
 *                     fileUrl: { type: string, nullable: true }
 *                     cursoId: { type: integer, nullable: true }
 *                     cursoNombre: { type: string, nullable: true }
 *                     puntos: { type: integer }
 *                     trimester: { type: integer }
 *                     teacherName: { type: string }
 *                 questions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       type: { type: string, enum: [mcq, file_upload] }
 *                       question: { type: string }
 *                       options: { type: array, items: { type: string }, nullable: true }
 *                       points: { type: integer }
 *                       orderIndex: { type: integer }
 *                       correctIndex: { type: integer, description: "Solo visible para profesores" }
 *                 submissions:
 *                   type: array
 *                   items:
 *                     type: object
 *                 role: { type: string }
 *                 notSubmitted:
 *                   type: array
 *                   description: "Solo para profesores - estudiantes que no entregaron"
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Tarea no encontrada
 *       500:
 *         description: Error interno
 *   put:
 *     summary: Editar tarea
 *     description: Actualiza una tarea existente. Solo el profesor que la creó puede editarla. Acepta JSON o multipart/form-data.
 *     tags: [Tareas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: ID de la tarea
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, description]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               dueDate: { type: string, format: date-time, nullable: true }
 *               trimester: { type: integer }
 *               subjectId: { type: integer, nullable: true }
 *               cursoId: { type: integer, nullable: true }
 *               puntos: { type: integer }
 *               fileUrl: { type: string, nullable: true }
 *               questions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     type: { type: string, enum: [mcq, file_upload] }
 *                     question: { type: string }
 *                     options: { type: array, items: { type: string } }
 *                     correctIndex: { type: integer }
 *                     points: { type: integer }
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               data: { type: string, description: "JSON string con los campos" }
 *               file: { type: string, format: binary, description: "Nuevo archivo adjunto" }
 *               _removeFile: { type: string, description: "Enviar 'true' para eliminar el archivo actual" }
 *     responses:
 *       200:
 *         description: Tarea actualizada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 updated: { type: boolean }
 *       400:
 *         description: Datos inválidos
 *       403:
 *         description: No autorizado o no eres el propietario
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno
 *   delete:
 *     summary: Eliminar tarea
 *     description: Elimina una tarea y todos sus datos asociados (preguntas, entregas, respuestas). Solo el profesor que la creó puede eliminarla.
 *     tags: [Tareas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: ID de la tarea
 *     responses:
 *       200:
 *         description: Tarea eliminada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 deleted: { type: boolean }
 *       403:
 *         description: No autorizado o no eres el propietario
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignments, assignmentQuestions, assignmentSubmissions, submissionAnswers, subjects, users, cursoEstudiantes, cursos } from "@/lib/db/schema";
import { eq, and, asc, inArray } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { getTeacherCourseIds } from "@/lib/course-helpers";
import { uploadFile, deleteFile } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get("atlas-edu-token")?.value;
    const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id } = await params;
    const assignmentId = parseInt(id);

    const [assignment] = await db
      .select({
        id: assignments.id,
        title: assignments.title,
        description: assignments.description,
        dueDate: assignments.dueDate,
        createdAt: assignments.createdAt,
        subjectName: subjects.name,
        subjectEmoji: subjects.emoji,
        subjectSlug: subjects.slug,
        subjectId: assignments.subjectId,
        fileUrl: assignments.fileUrl,
        cursoId: assignments.cursoId,
        cursoNombre: cursos.nombre,
        puntos: assignments.puntos,
        trimester: assignments.trimester,
        teacherName: users.fullName,
      })
      .from(assignments)
      .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
      .leftJoin(users, eq(assignments.teacherId, users.id))
      .leftJoin(cursos, eq(assignments.cursoId, cursos.id))
      .where(eq(assignments.id, assignmentId));

    if (!assignment) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }

    // Get questions
    const questions = await db
      .select()
      .from(assignmentQuestions)
      .where(eq(assignmentQuestions.assignmentId, assignmentId))
      .orderBy(asc(assignmentQuestions.orderIndex));

    // Get submissions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let submissions: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let notSubmitted: any[] = [];
    if (user.role === "teacher") {
      submissions = await db
        .select({
          id: assignmentSubmissions.id,
          studentId: assignmentSubmissions.studentId,
          studentName: users.fullName,
          studentCedula: users.cedula,
          content: assignmentSubmissions.content,
          fileUrl: assignmentSubmissions.fileUrl,
          status: assignmentSubmissions.status,
          submittedAt: assignmentSubmissions.submittedAt,
          grade: assignmentSubmissions.grade,
          feedback: assignmentSubmissions.feedback,
        })
        .from(assignmentSubmissions)
        .leftJoin(users, eq(assignmentSubmissions.studentId, users.id))
        .where(eq(assignmentSubmissions.assignmentId, assignmentId));

      // Get answers per submission
      const allAnswers = await db
        .select()
        .from(submissionAnswers)
        .leftJoin(assignmentQuestions, eq(submissionAnswers.questionId, assignmentQuestions.id))
        .where(
          and(
            eq(assignmentQuestions.assignmentId, assignmentId)
          )
        );

      submissions = submissions.map(s => ({
        ...s,
        answers: allAnswers.filter(a => a.submission_answers?.submissionId === s.id).map(a => ({
          questionId: a.assignment_questions?.id,
          question: a.assignment_questions?.question,
          type: a.assignment_questions?.type,
          selectedIndex: a.submission_answers?.selectedIndex,
          isCorrect: a.submission_answers?.isCorrect,
          correctIndex: a.assignment_questions?.correctIndex,
        })),
        mcqScore: allAnswers
          .filter(a => a.submission_answers?.submissionId === s.id && a.submission_answers?.isCorrect)
          .length,
        mcqTotal: questions.filter(q => q.type === "mcq").length,
      }));

      // Find students who haven't submitted - only from this assignment's course
      let allStudents: { id: number; fullName: string; cedula: string }[] = [];
      if (assignment.cursoId) {
        allStudents = await db
          .select({ id: users.id, fullName: users.fullName, cedula: users.cedula })
          .from(users)
          .innerJoin(cursoEstudiantes, eq(users.id, cursoEstudiantes.estudianteId))
          .where(and(
            eq(cursoEstudiantes.cursoId, assignment.cursoId),
            eq(users.role, "student")
          ))
          .limit(200);
      } else {
        const uniqueCourses = await getTeacherCourseIds(user.id);

        if (uniqueCourses.length > 0) {
          allStudents = await db
            .select({ id: users.id, fullName: users.fullName, cedula: users.cedula })
            .from(users)
            .innerJoin(cursoEstudiantes, eq(users.id, cursoEstudiantes.estudianteId))
            .where(and(
              inArray(cursoEstudiantes.cursoId, uniqueCourses),
              eq(users.role, "student")
            ))
            .limit(200);
        } else {
          allStudents = [];
        }
      }

      const submittedIds = new Set(submissions.map(s => s.studentId));
      notSubmitted = allStudents
        .filter(s => !submittedIds.has(s.id))
        .map(s => ({
          studentId: s.id,
          studentName: s.fullName,
          studentCedula: s.cedula,
          expired: assignment.dueDate ? new Date() > new Date(assignment.dueDate) : false,
        }));
    } else {
      const [sub] = await db
        .select({
          id: assignmentSubmissions.id,
          content: assignmentSubmissions.content,
          fileUrl: assignmentSubmissions.fileUrl,
          status: assignmentSubmissions.status,
          submittedAt: assignmentSubmissions.submittedAt,
          grade: assignmentSubmissions.grade,
          feedback: assignmentSubmissions.feedback,
        })
        .from(assignmentSubmissions)
        .where(
          and(
            eq(assignmentSubmissions.assignmentId, assignmentId),
            eq(assignmentSubmissions.studentId, user.id)
          )
        );

      if (sub) {
        const answers = await db
          .select()
          .from(submissionAnswers)
          .where(eq(submissionAnswers.submissionId, sub.id));

        submissions = [{ ...sub, answers: answers.map(a => ({
          questionId: a.questionId,
          selectedIndex: a.selectedIndex,
          isCorrect: a.isCorrect,
        })) }];
      } else {
        submissions = [];
      }
    }

    return NextResponse.json({
      assignment,
      questions: questions.map(q => ({
        id: q.id,
        type: q.type,
        question: q.question,
        options: q.options,
        points: q.points,
        orderIndex: q.orderIndex,
        correctIndex: user.role === "teacher" ? q.correctIndex : undefined,
      })),
      submissions,
      role: user.role,
      ...(user.role === "teacher" && { notSubmitted }),
    });
  } catch (error) {
    console.error("GET /api/assignments/[id] error:", error);
    return NextResponse.json({ error: "Error en la tarea" }, { status: 500 });
  }
}

// PUT: edit assignment
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get("atlas-edu-token")?.value;
    const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
    if (!user || user.role !== "teacher") {
      return NextResponse.json({ error: "Solo docentes pueden editar" }, { status: 403 });
    }

    const { id } = await params;
    const assignmentId = parseInt(id);

    const contentType = request.headers.get("content-type") || "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let body: Record<string, any>;
    let newFileUrl: string | null | undefined = undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const dataStr = formData.get("data") as string | null;
      const file = formData.get("file") as File | null;

      if (!dataStr) {
        return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
      }

      body = JSON.parse(dataStr);

      // Determine if file should be removed
      if (body._removeFile) {
        newFileUrl = null;
      }

      if (file && file.size > 0) {
        const MAX_FILE_SIZE = 1024 * 1024 * 1024;
        const ALLOWED_TYPES = [
          "application/pdf", "image/jpeg", "image/png", "image/webp",
          "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "text/plain", "application/zip",
        ];

        if (file.size > MAX_FILE_SIZE) {
          return NextResponse.json({ error: "Archivo excede 1 GB" }, { status: 400 });
        }
        if (!ALLOWED_TYPES.includes(file.type)) {
          return NextResponse.json({ error: "Formato no permitido" }, { status: 400 });
        }

        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const fileName = `teacher_${user.id}_${timestamp}_${safeName}`;

        const bytes = await file.arrayBuffer();
        newFileUrl = await uploadFile(Buffer.from(bytes), fileName, file.type);
      }
    } else {
      body = await request.json();
    }

    const { title, description, dueDate, trimester, subjectId, cursoId, puntos, questions, fileUrl } = body;

    if (!title || !description) {
      return NextResponse.json({ error: "Título y descripción requeridos" }, { status: 400 });
    }

    const [existing] = await db
      .select({ teacherId: assignments.teacherId, fileUrl: assignments.fileUrl })
      .from(assignments)
      .where(eq(assignments.id, assignmentId))
      .limit(1);
    if (!existing || existing.teacherId !== user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateValues: Record<string, any> = {
      title,
      description,
      dueDate: dueDate ? new Date(dueDate) : null,
      trimester: trimester || 1,
    };
    if (subjectId != null) updateValues.subjectId = subjectId;
    if (cursoId !== undefined) updateValues.cursoId = cursoId || null;
    if (puntos !== undefined) updateValues.puntos = puntos;
    if (newFileUrl !== undefined) {
      updateValues.fileUrl = newFileUrl;
    } else if (fileUrl !== undefined) {
      updateValues.fileUrl = fileUrl;
    }

    // Delete old file if replaced or removed
    if (newFileUrl !== undefined && existing.fileUrl) {
      try { await deleteFile(existing.fileUrl); } catch {}
    }

    await db
      .update(assignments)
      .set(updateValues)
      .where(eq(assignments.id, assignmentId));

    // Replace questions
    if (questions) {
      // Delete submissionAnswers that belong to submissions of this assignment
      const subIds = await db
        .select({ id: assignmentSubmissions.id })
        .from(assignmentSubmissions)
        .where(eq(assignmentSubmissions.assignmentId, assignmentId));
      const submissionIds = subIds.map(s => s.id);
      if (submissionIds.length > 0) {
        await db.delete(submissionAnswers)
          .where(inArray(submissionAnswers.submissionId, submissionIds));
      }

      await db.delete(assignmentQuestions)
        .where(eq(assignmentQuestions.assignmentId, assignmentId));

      if (questions.length > 0) {
        await db.insert(assignmentQuestions).values(
          questions.map((q: { type: string; question: string; options?: string[]; correctIndex?: number; points?: number }, i: number) => ({
            assignmentId,
            type: q.type,
            question: q.question,
            options: q.options || null,
            correctIndex: q.correctIndex ?? null,
            points: q.points || 1,
            orderIndex: i,
          }))
        );
      }
    }

    return NextResponse.json({ success: true, updated: true });
  } catch (error) {
    console.error("PUT /api/assignments/[id] error:", error);
    return NextResponse.json({ error: "Error en la tarea" }, { status: 500 });
  }
}

// DELETE: delete assignment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get("atlas-edu-token")?.value;
    const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
    if (!user || user.role !== "teacher") {
      return NextResponse.json({ error: "Solo docentes pueden eliminar" }, { status: 403 });
    }

    const { id } = await params;
    const assignmentId = parseInt(id);

    // Verify teacher owns this assignment
    const [existing] = await db
      .select({ teacherId: assignments.teacherId })
      .from(assignments)
      .where(eq(assignments.id, assignmentId))
      .limit(1);
    if (!existing || existing.teacherId !== user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Cascade delete: submissionAnswers -> submissions -> questions -> assignment
    const subs = await db
      .select({ id: assignmentSubmissions.id })
      .from(assignmentSubmissions)
      .where(eq(assignmentSubmissions.assignmentId, assignmentId));
    const subIds = subs.map(s => s.id);

    if (subIds.length > 0) {
      await db.delete(submissionAnswers)
        .where(inArray(submissionAnswers.submissionId, subIds));
    }

    await db.delete(assignmentSubmissions)
      .where(eq(assignmentSubmissions.assignmentId, assignmentId));

    await db.delete(assignmentQuestions)
      .where(eq(assignmentQuestions.assignmentId, assignmentId));

    await db.delete(assignments)
      .where(eq(assignments.id, assignmentId));

    return NextResponse.json({ success: true, deleted: true });
  } catch (error) {
    console.error("DELETE /api/assignments/[id] error:", error);
    return NextResponse.json({ error: "Error en la tarea" }, { status: 500 });
  }
}
