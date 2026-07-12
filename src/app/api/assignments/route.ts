/**
 * @swagger
 * /api/assignments:
 *   get:
 *     summary: Listar tareas
 *     description: Devuelve tareas del profesor o del estudiante según el rol.
 *     tags: [Tareas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cursoId
 *         schema: { type: integer }
 *         description: Filtrar por curso
 *     responses:
 *       200:
 *         description: Lista de tareas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 assignments:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       title: { type: string }
 *                       description: { type: string, nullable: true }
 *                       dueDate: { type: string, format: date-time, nullable: true }
 *                       createdAt: { type: string, format: date-time }
 *                       subjectName: { type: string }
 *                       subjectEmoji: { type: string }
 *                       subjectSlug: { type: string }
 *                       cursoId: { type: integer, nullable: true }
 *                       cursoNombre: { type: string, nullable: true }
 *                       puntos: { type: integer }
 *                       fileUrl: { type: string, nullable: true }
 *                       trimester: { type: integer }
 *                       submissionCount: { type: integer }
 *                       status: { type: string, nullable: true }
 *                       grade: { type: integer, nullable: true }
 *                       teacherName: { type: string, nullable: true }
 *                       periodoNombre: { type: string, nullable: true }
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno
 *   post:
 *     summary: Crear tarea
 *     description: Crea una nueva tarea con preguntas de opción múltiple o archivo. Acepta JSON o multipart/form-data.
 *     tags: [Tareas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, description, subjectId, questions]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               subjectId: { type: integer }
 *               cursoId: { type: integer }
 *               puntos: { type: integer, default: 10 }
 *               dueDate: { type: string, format: date-time }
 *               trimester: { type: integer }
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
 *               file: { type: string, format: binary, description: "Archivo adjunto" }
 *     responses:
 *       201:
 *         description: Tarea creada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 assignment: { type: object }
 *                 questionsCount: { type: integer }
 *       400:
 *         description: Datos inválidos
 *       403:
 *         description: Solo docentes pueden crear tareas
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno
 */
import { NextRequest, NextResponse } from "next/server";
import { uploadFile } from "@/lib/storage";
import { db } from "@/lib/db";
import { assignments, assignmentQuestions, assignmentSubmissions, subjects, users, cursos, periodosLectivos, cursoEstudiantes } from "@/lib/db/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { teacherHasCourseAccess } from "@/lib/course-helpers";
import { assignmentSchema } from "@/lib/api-helpers";
import { notifyStudentsInCourse } from "@/lib/notifications";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("atlas-edu-token")?.value;
    const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    if (user.role === "teacher") {
      const data = await db
        .select({
          id: assignments.id,
          title: assignments.title,
          description: assignments.description,
          dueDate: assignments.dueDate,
          createdAt: assignments.createdAt,
          subjectName: subjects.name,
          subjectEmoji: subjects.emoji,
          subjectSlug: subjects.slug,
          cursoId: assignments.cursoId,
          cursoNombre: cursos.nombre,
          periodoNombre: periodosLectivos.nombre,
          puntos: assignments.puntos,
          fileUrl: assignments.fileUrl,
          trimester: assignments.trimester,
        })
        .from(assignments)
        .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
        .leftJoin(cursos, eq(assignments.cursoId, cursos.id))
        .leftJoin(periodosLectivos, eq(assignments.periodoLectivoId, periodosLectivos.id))
        .where(eq(assignments.teacherId, user.id))
        .orderBy(desc(assignments.createdAt));

      // Batch count submissions in one query
      const assignmentIds = data.map(a => a.id);
      const counts = assignmentIds.length > 0 ? await db
        .select({
          assignmentId: assignmentSubmissions.assignmentId,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(assignmentSubmissions)
        .where(inArray(assignmentSubmissions.assignmentId, assignmentIds))
        .groupBy(assignmentSubmissions.assignmentId) : [];
      const countMap = new Map(counts.map(c => [c.assignmentId, c.count]));

      return NextResponse.json({
        assignments: data.map(a => ({ ...a, submissionCount: countMap.get(a.id) || 0 })),
      });
    }

    // Student: only show assignments from their enrolled courses
    const enrolledCourses = await db
      .select({ cursoId: cursoEstudiantes.cursoId })
      .from(cursoEstudiantes)
      .where(eq(cursoEstudiantes.estudianteId, user.id));
    const enrolledIds = new Set(enrolledCourses.map(c => c.cursoId));

    if (enrolledIds.size === 0) {
      return NextResponse.json({ assignments: [] });
    }

    const raw = await db
      .select({
        id: assignments.id,
        title: assignments.title,
        description: assignments.description,
        dueDate: assignments.dueDate,
        createdAt: assignments.createdAt,
        teacherName: users.fullName,
        subjectName: subjects.name,
        subjectEmoji: subjects.emoji,
        subjectSlug: subjects.slug,
        fileUrl: assignments.fileUrl,
        cursoId: assignments.cursoId,
        cursoNombre: cursos.nombre,
        status: assignmentSubmissions.status,
        grade: assignmentSubmissions.grade,
      })
      .from(assignments)
      .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
      .leftJoin(users, eq(assignments.teacherId, users.id))
      .leftJoin(cursos, eq(assignments.cursoId, cursos.id))
      .leftJoin(
        assignmentSubmissions,
        and(
          eq(assignmentSubmissions.assignmentId, assignments.id),
          eq(assignmentSubmissions.studentId, user.id)
        )
      )
      .orderBy(desc(assignments.createdAt));

    const data = (raw as any[]).filter((a: any) => enrolledIds.has(a.cursoId));

    return NextResponse.json({ assignments: data });
  } catch (error) {
    console.error("GET /api/assignments error:", error);
    return NextResponse.json({ error: "Error al gestionar tareas" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("atlas-edu-token")?.value;
    const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
    if (!user || user.role !== "teacher") {
      return NextResponse.json({ error: "Solo docentes pueden crear tareas" }, { status: 403 });
    }

    const contentType = request.headers.get("content-type") || "";
    let body: Record<string, any>;
    let fileUrl: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const dataStr = formData.get("data") as string | null;
      const file = formData.get("file") as File | null;

      if (!dataStr) {
        return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
      }

      body = JSON.parse(dataStr);

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
        fileUrl = await uploadFile(Buffer.from(bytes), fileName, file.type);
      }
    } else {
      body = await request.json();
    }

    console.log("POST /api/assignments body keys:", Object.keys(body), "dueDate:", body.dueDate, "fileUrl:", body.fileUrl, "type of dueDate:", typeof body.dueDate);

    const parsed = assignmentSchema.safeParse(body);

    if (!parsed.success) {
      console.error("POST /api/assignments Zod error:", JSON.stringify(parsed.error.flatten()));
      return NextResponse.json({ error: "Datos invalidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const { title, description, subjectId, cursoId, dueDate, trimester, questions } = parsed.data;

    if (subjectId) {
      const [subjectExists] = await db
        .select({ id: subjects.id })
        .from(subjects)
        .where(eq(subjects.id, subjectId))
        .limit(1);
      if (!subjectExists) {
        return NextResponse.json({ error: "Materia no encontrada" }, { status: 400 });
      }
    }

    if (cursoId) {
      const hasAccess = await teacherHasCourseAccess(user.id, cursoId);
      if (!hasAccess) {
        return NextResponse.json({ error: "No perteneces a este curso" }, { status: 403 });
      }
    }

    const [activePeriod] = await db
      .select({ id: periodosLectivos.id })
      .from(periodosLectivos)
      .where(eq(periodosLectivos.activo, true))
      .limit(1);

    const [assignment] = await db
      .insert(assignments)
      .values({
        teacherId: user.id,
        subjectId,
        cursoId: cursoId || null,
      title,
      description,
      dueDate: dueDate ? new Date(dueDate) : null,
      trimester: trimester || 1,
      puntos: parsed.data.puntos ?? 10,
      fileUrl: fileUrl || parsed.data.fileUrl || null,
      periodoLectivoId: activePeriod?.id || null,
    } as any)
    .returning();

    if (questions && questions.length > 0) {
      await db.insert(assignmentQuestions).values(
        questions.map((q: any, i: number) => ({
          assignmentId: assignment.id,
          type: q.type,
          question: q.question,
          options: q.options || null,
          correctIndex: q.correctIndex ?? null,
          points: q.points || 1,
          orderIndex: i,
        } as any))
      );
    }

    if (cursoId) {
      await notifyStudentsInCourse({
        cursoId,
        type: "assignment",
        title: `Nueva tarea: ${assignment.title}`,
        message: description?.slice(0, 120) || "Tienes una nueva tarea asignada",
        link: `/student/assignments/${assignment.id}`,
        relatedId: assignment.id,
      });
    }

    return NextResponse.json({ assignment, questionsCount: questions?.length || 0 });
  } catch (error) {
    console.error("POST /api/assignments error:", error);
    return NextResponse.json({ error: "Error al gestionar tareas", detail: String(error) }, { status: 500 });
  }
}
