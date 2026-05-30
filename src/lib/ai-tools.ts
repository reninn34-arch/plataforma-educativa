import { tool } from "ai";
import { z } from "zod/v4";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import {
  users, subjects, progress, cursos, cursoEstudiantes,
  cursoProfesores, assignments, assignmentSubmissions,
  assignmentQuestions, practiceSessions, asistencia,
  periodosLectivos, directMessages, modules,
} from "@/lib/db/schema";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { opencodeGoModel, logAiCall } from "@/lib/ai";
import { generateText } from "ai";
import { getSmtpConfig } from "@/lib/smtp-config";

function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// ═══════════════════ TEACHER TOOLS ═══════════════════

function createTeacherTools(userId: number, userFullName: string) {

  // ─── Consulta ───

  const getMyCourses = tool({
    description: "Obtiene la lista de cursos que imparte o tutoriza el docente actual",
    inputSchema: z.object({}),
    execute: async () => {
      const own = await db
        .select({ id: cursos.id, nombre: cursos.nombre, nivel: cursos.nivel })
        .from(cursos)
        .innerJoin(cursoProfesores, eq(cursoProfesores.cursoId, cursos.id))
        .where(eq(cursoProfesores.teacherId, userId));
      const tutor = await db
        .select({ id: cursos.id, nombre: cursos.nombre, nivel: cursos.nivel })
        .from(cursos)
        .where(eq(cursos.profesorId, userId));
      const all = [...own, ...tutor.filter(t => !own.some(o => o.id === t.id))];
      return { cursos: all, total: all.length };
    },
  });

  const getCourseStudents = tool({
    description: "Obtiene la lista de estudiantes de un curso con cedulas y estado",
    inputSchema: z.object({ cursoId: z.number().describe("ID del curso") }),
    execute: async ({ cursoId }) => {
      const enrolled = await db
        .select({ id: users.id, fullName: users.fullName, cedula: users.cedula, activo: users.activo, email: users.email })
        .from(users)
        .innerJoin(cursoEstudiantes, eq(cursoEstudiantes.estudianteId, users.id))
        .where(and(eq(cursoEstudiantes.cursoId, cursoId), eq(users.activo, true)))
        .orderBy(users.fullName);
      return { estudiantes: enrolled, total: enrolled.length };
    },
  });

  const getStudentRisk = tool({
    description: "Identifica estudiantes en riesgo: 3+ fallos consecutivos o 7+ dias inactivos",
    inputSchema: z.object({
      cursoId: z.number().optional().describe("ID del curso. Si se omite, busca en todos los cursos del docente"),
    }),
    execute: async ({ cursoId }) => {
      let studentIds: number[] = [];
      if (cursoId) {
        const enrolled = await db.select({ estudianteId: cursoEstudiantes.estudianteId }).from(cursoEstudiantes).where(eq(cursoEstudiantes.cursoId, cursoId));
        studentIds = enrolled.map(e => e.estudianteId);
      }
      const riskData = await db
        .select({ id: users.id, fullName: users.fullName, cedula: users.cedula, consecutiveFailures: progress.consecutiveFailures, daysInactive: progress.daysInactive, subjectName: subjects.name, subjectEmoji: subjects.emoji })
        .from(progress).innerJoin(users, eq(users.id, progress.userId)).innerJoin(subjects, eq(subjects.id, progress.subjectId))
        .where(and(eq(users.role, "student"), eq(users.activo, true), sql`(${progress.consecutiveFailures} >= 3 OR ${progress.daysInactive} >= 7)`));
      const filtered = studentIds.length > 0 ? riskData.filter(r => studentIds.includes(r.id)) : riskData;
      return { en_riesgo: filtered, total: filtered.length, criterio: "3+ fallos consecutivos o 7+ dias inactivos" };
    },
  });

  const getAttendanceToday = tool({
    description: "Obtiene la asistencia de hoy para un curso",
    inputSchema: z.object({ cursoId: z.number().describe("ID del curso") }),
    execute: async ({ cursoId }) => {
      const hoy = new Date().toISOString().slice(0, 10);
      const data = await db
        .select({ studentId: asistencia.studentId, studentName: users.fullName, cedula: users.cedula, estado: asistencia.estado })
        .from(asistencia).innerJoin(users, eq(users.id, asistencia.studentId))
        .where(and(eq(asistencia.cursoId, cursoId), eq(asistencia.fecha, new Date(hoy)))).orderBy(users.fullName);
      const presentes = data.filter(r => r.estado === "presente").length;
      const ausentes = data.filter(r => r.estado === "ausente").length;
      return { fecha: hoy, asistencia: data, resumen: { presentes, ausentes, total: data.length } };
    },
  });

  const getRecentAssignments = tool({
    description: "Obtiene las tareas recientes del docente con conteo de entregas y pendientes",
    inputSchema: z.object({
      cursoId: z.number().optional().describe("Filtrar por curso"),
      limit: z.number().optional().default(5).describe("Cuantas tareas"),
    }),
    execute: async ({ cursoId, limit }) => {
      const conds: any[] = [eq(assignments.teacherId, userId)];
      if (cursoId) conds.push(eq(assignments.cursoId, cursoId));
      const tareas = await db
        .select({ id: assignments.id, title: assignments.title, dueDate: assignments.dueDate, trimester: assignments.trimester, puntos: assignments.puntos, subjectName: subjects.name, subjectEmoji: subjects.emoji, cursoNombre: cursos.nombre })
        .from(assignments).innerJoin(subjects, eq(subjects.id, assignments.subjectId)).leftJoin(cursos, eq(cursos.id, assignments.cursoId))
        .where(and(...conds)).orderBy(desc(assignments.createdAt)).limit(limit || 5);
      const result = [];
      for (const t of tareas) {
        const subs = await db.select({ id: assignmentSubmissions.id, status: assignmentSubmissions.status }).from(assignmentSubmissions).where(eq(assignmentSubmissions.assignmentId, t.id));
        result.push({ ...t, entregadas: subs.filter(s => s.status === "submitted" || s.status === "graded").length, pendientes: subs.filter(s => s.status === "pending").length });
      }
      return { tareas: result };
    },
  });

  const getPracticeAnalytics = tool({
    description: "Obtiene estadisticas de practica con IA por estudiante",
    inputSchema: z.object({ cursoId: z.number().optional().describe("Filtrar por curso") }),
    execute: async ({ cursoId }) => {
      let studentIds: number[] = [];
      if (cursoId) { const enrolled = await db.select({ estudianteId: cursoEstudiantes.estudianteId }).from(cursoEstudiantes).where(eq(cursoEstudiantes.cursoId, cursoId)); studentIds = enrolled.map(e => e.estudianteId); }
      const conds: any[] = [];
      if (studentIds.length > 0) conds.push(inArray(practiceSessions.userId, studentIds));
      const sessions = await db
        .select({ userId: practiceSessions.userId, studentName: users.fullName, subjectName: subjects.name, subjectEmoji: subjects.emoji, correctCount: practiceSessions.correctCount, totalCount: practiceSessions.totalCount, score: practiceSessions.score, maxCombo: practiceSessions.maxCombo, createdAt: practiceSessions.createdAt })
        .from(practiceSessions).innerJoin(users, eq(users.id, practiceSessions.userId)).innerJoin(subjects, eq(subjects.id, practiceSessions.subjectId))
        .where(and(...conds)).orderBy(desc(practiceSessions.createdAt)).limit(30);
      const avgScore = sessions.length > 0 ? Math.round(sessions.reduce((sum, s) => sum + s.score, 0) / sessions.length) : 0;
      return { sesiones_recientes: sessions, total_sesiones: sessions.length, promedio_puntaje: avgScore };
    },
  });

  // ─── Acción ───

  const generateAndCreateAssignment = tool({
    description: "Genera una tarea con IA y la publica automaticamente en la plataforma. Usala cuando el docente pida crear una tarea nueva. Pregunta siempre el curso, materia, tema, numero de preguntas y fecha de entrega si el docente no los especifica. Si el usuario proporciona contenido en un archivo adjunto, basa las preguntas estrictamente en ese contenido.",
    inputSchema: z.object({
      cursoId: z.number().describe("ID del curso al que se asigna la tarea"),
      subjectId: z.number().describe("ID de la materia"),
      topic: z.string().describe("Tema de la tarea, ej: Suma de fracciones, Simple Past"),
      questionCount: z.number().optional().default(5).describe("Cantidad de preguntas (3-10)"),
      trimester: z.number().optional().default(1).describe("Trimestre 1, 2 o 3"),
      dueDate: z.string().optional().describe("Fecha de entrega en formato ISO, ej: 2025-06-15T23:59"),
      puntos: z.number().optional().default(10).describe("Puntaje maximo de la tarea"),
    }),
    execute: async ({ cursoId, subjectId, topic, questionCount, trimester, dueDate, puntos }) => {
      const subjectData = await db.select({ name: subjects.name, slug: subjects.slug }).from(subjects).where(eq(subjects.id, subjectId)).limit(1);
      const subjectName = subjectData[0]?.name || "materia";

      const count = Math.min(Math.max(3, questionCount || 5), 10);

      const aiPrompt = `Eres un docente experto creando tareas para educacion secundaria acelerada de adultos (PCEI Ecuador). Genera una tarea en JSON.

Materia: ${subjectName}
Tema: ${topic}
Cantidad de preguntas: ${count}
Trimestre: ${trimester || 1}

REGLAS:
1. Titulo claro (max 200 chars). Descripcion con instrucciones practicas para adultos (min 2 parrafos).
2. Preguntas variadas: maximo 1 tipo "file_upload", el resto "mcq".
3. MCQ: 4 opciones plausibles, correctIndex 0-3, points entre 1-5.
4. File upload: describir que entregar, points entre 5-10.
5. Lenguaje adulto, contexto practico/laboral.
6. IMPORTANTISIMO: SOLO responde con JSON puro. Empieza con { y termina con }. Sin markdown.

FORMATO:
{
  "title": "...",
  "description": "...",
  "questions": [
    { "type": "mcq", "question": "...", "options": ["A","B","C","D"], "correctIndex": 0, "points": 1 },
    { "type": "file_upload", "question": "...", "points": 8 }
  ]
}`;

      const start = Date.now();
      const aiResult = await generateText({ model: opencodeGoModel, prompt: aiPrompt, temperature: 0.6, maxOutputTokens: 8000 });
      logAiCall({ route: "ai-tool/generate-assignment", model: "kimi-k2.5", durationMs: Date.now() - start, usage: aiResult.usage ? { inputTokens: aiResult.usage.inputTokens, outputTokens: aiResult.usage.outputTokens, totalTokens: (aiResult.usage.inputTokens ?? 0) + (aiResult.usage.outputTokens ?? 0) } : undefined });

      let text = aiResult.text || "";
      text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      const data = JSON.parse(text);

      const [assignment] = await db.insert(assignments).values({
        teacherId: userId,
        subjectId,
        cursoId,
        title: data.title?.slice(0, 200) || topic,
        description: data.description || `Tarea sobre ${topic}`,
        trimester: trimester || 1,
        puntos: puntos || 10,
        dueDate: dueDate ? new Date(dueDate) : undefined,
      } as any).returning();

      const questions = (data.questions || []).slice(0, 15);
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await db.insert(assignmentQuestions).values({
          assignmentId: assignment.id,
          type: q.type === "file_upload" ? "file_upload" : "mcq",
          question: q.question || "",
          options: q.type === "file_upload" ? undefined : (q.options || []),
          correctIndex: q.type === "file_upload" ? undefined : (q.correctIndex ?? 0),
          points: q.points || 1,
          orderIndex: i,
        } as any);
      }

      return {
        creada: true,
        tarea_id: assignment.id,
        titulo: data.title,
        preguntas: questions.length,
        mensaje: `Tarea "${data.title}" creada exitosamente con ${questions.length} preguntas para ${subjectName}.`,
      };
    },
  });

  const sendMessageToStudents = tool({
    description: "Envia un mensaje directo a todos los estudiantes de un curso. Usala cuando el docente pida notificar, avisar o recordar algo a sus alumnos.",
    inputSchema: z.object({
      cursoId: z.number().describe("ID del curso cuyos estudiantes recibiran el mensaje"),
      message: z.string().min(1).describe("Contenido del mensaje a enviar"),
    }),
    execute: async ({ cursoId, message }) => {
      const students = await db
        .select({ id: users.id, fullName: users.fullName })
        .from(users)
        .innerJoin(cursoEstudiantes, eq(cursoEstudiantes.estudianteId, users.id))
        .where(and(eq(cursoEstudiantes.cursoId, cursoId), eq(users.activo, true)));

      if (students.length === 0) return { enviados: 0, error: "No hay estudiantes activos en este curso" };

      let sent = 0;
      for (const s of students) {
        await db.insert(directMessages).values({
          senderId: userId,
          receiverId: s.id,
          content: message,
        } as any);
        sent++;
      }

      const cursoData = await db.select({ nombre: cursos.nombre }).from(cursos).where(eq(cursos.id, cursoId)).limit(1);
      return {
        enviados: sent,
        estudiantes: students.map(s => s.fullName),
        curso: cursoData[0]?.nombre || "",
        mensaje: `Mensaje enviado a ${sent} estudiantes de ${cursoData[0]?.nombre || "el curso"}.`,
      };
    },
  });

  const markStudentsAbsent = tool({
    description: "Marca como ausentes a los estudiantes de un curso que no entregaron una tarea. Usala cuando el docente diga 'marca como no entregaron' o 'pon ausentes a los que faltaron'.",
    inputSchema: z.object({
      assignmentId: z.number().describe("ID de la tarea desde la cual verificar quienes no entregaron"),
      motivo: z.string().optional().default("No entrego la tarea").describe("Motivo opcional"),
    }),
    execute: async ({ assignmentId, motivo }) => {
      const [tarea] = await db.select({ cursoId: assignments.cursoId, title: assignments.title }).from(assignments).where(eq(assignments.id, assignmentId)).limit(1);
      if (!tarea || !tarea.cursoId) return { error: "Tarea no encontrada o no tiene curso asignado" };

      const allStudents = await db
        .select({ id: users.id, fullName: users.fullName })
        .from(users).innerJoin(cursoEstudiantes, eq(cursoEstudiantes.estudianteId, users.id))
        .where(and(eq(cursoEstudiantes.cursoId, tarea.cursoId), eq(users.activo, true)));

      const submitted = await db
        .select({ studentId: assignmentSubmissions.studentId })
        .from(assignmentSubmissions).where(eq(assignmentSubmissions.assignmentId, assignmentId));
      const submittedIds = new Set(submitted.map(s => s.studentId));
      const noEntrego = allStudents.filter(s => !submittedIds.has(s.id));

      if (noEntrego.length === 0) return { marcados: 0, mensaje: "Todos los estudiantes ya entregaron la tarea." };

      const today = new Date().toISOString().slice(0, 10);
      for (const s of noEntrego) {
        await db.insert(asistencia).values({
          cursoId: tarea.cursoId,
          studentId: s.id,
          fecha: new Date(today),
          estado: "ausente",
        } as any).onConflictDoUpdate({
          target: [asistencia.cursoId, asistencia.studentId, asistencia.fecha],
          set: { estado: "ausente" } as any,
        });
      }

      return {
        marcados: noEntrego.length,
        estudiantes: noEntrego.map(s => s.fullName),
        tarea: tarea.title,
        mensaje: `Se marco como ausentes a ${noEntrego.length} estudiantes que no entregaron "${tarea.title}".`,
      };
    },
  });

  const checkAcademicLoad = tool({
    description: "Verifica la carga academica de un curso o nivel para ver si los estudiantes tienen demasiadas tareas acumuladas. Muestra las tareas programadas con sus fechas de entrega.",
    inputSchema: z.object({
      cursoId: z.number().optional().describe("ID del curso especifico"),
      nivel: z.string().optional().describe("Nivel o paralelo, ej: '3ro BGU', '2do BGU'"),
      daysAhead: z.number().optional().default(7).describe("Cantidad de dias a revisar hacia el futuro"),
    }),
    execute: async ({ cursoId, nivel, daysAhead }) => {
      let courseIds: number[] = [];
      if (cursoId) {
        courseIds = [cursoId];
      } else if (nivel) {
        const matchingCourses = await db
          .select({ id: cursos.id })
          .from(cursos)
          .where(and(eq(cursos.activo, true), sql`lower(${cursos.nivel}) LIKE ${`%${nivel.toLowerCase()}%`}`));
        courseIds = matchingCourses.map(c => c.id);
      } else {
        return { error: "Debe proporcionar cursoId o nivel" };
      }

      if (courseIds.length === 0) {
        return { tareas: [], mensaje: "No se encontraron cursos activos para este criterio." };
      }

      const now = new Date();
      const futureLimit = new Date();
      futureLimit.setDate(now.getDate() + (daysAhead || 7));

      const tasks = await db
        .select({
          id: assignments.id,
          title: assignments.title,
          dueDate: assignments.dueDate,
          subjectName: subjects.name,
          cursoNombre: cursos.nombre,
          nivel: cursos.nivel,
        })
        .from(assignments)
        .innerJoin(cursos, eq(cursos.id, assignments.cursoId))
        .innerJoin(subjects, eq(subjects.id, assignments.subjectId))
        .where(
          and(
            inArray(sql`${assignments.cursoId}::int`, courseIds),
            sql`${assignments.dueDate} >= ${now} AND ${assignments.dueDate} <= ${futureLimit}`
          )
        )
        .orderBy(assignments.dueDate);

      return {
        tareas: tasks,
        total: tasks.length,
        mensaje: `Se encontraron ${tasks.length} tareas programadas para los proximos ${daysAhead} dias en los cursos seleccionados.`,
      };
    },
  });

  const recordPhysicalGrades = tool({
    description: "Registra en bloque calificaciones para una actividad fisica o presencial (ej: exposiciones, lecciones fisicas, participacion) en un curso. Crea la tarea si no existe.",
    inputSchema: z.object({
      cursoId: z.number().describe("ID del curso al que pertenecen los alumnos"),
      subjectId: z.number().describe("ID de la materia"),
      activityTitle: z.string().describe("Titulo de la actividad fisica, ej: 'Exposicion de Historia', 'Leccion 1'"),
      puntos: z.number().optional().default(10).describe("Puntaje maximo de la actividad"),
      trimester: z.number().optional().default(1).describe("Trimestre al que pertenece la actividad (1, 2 o 3)"),
      grades: z.array(z.object({
        fullName: z.string().describe("Nombre o apellido del estudiante (busqueda flexible)"),
        grade: z.number().describe("Nota obtenida (ej: 0 a 10)"),
        feedback: z.string().optional().describe("Comentario de retroalimentacion"),
      })).min(1).describe("Listado de estudiantes y sus calificaciones"),
    }),
    execute: async ({ cursoId, subjectId, activityTitle, puntos, trimester, grades }) => {
      const [course] = await db.select({ nombre: cursos.nombre, profesorId: cursos.profesorId }).from(cursos).where(eq(cursos.id, cursoId)).limit(1);
      if (!course) return { error: "Curso no encontrado" };

      let assignmentId: number;
      const [existing] = await db
        .select({ id: assignments.id })
        .from(assignments)
        .where(and(eq(assignments.cursoId, cursoId), eq(assignments.subjectId, subjectId), eq(assignments.title, activityTitle)))
        .limit(1);
      
      const activePeriod = await db
        .select({ id: periodosLectivos.id })
        .from(periodosLectivos)
        .where(eq(periodosLectivos.activo, true))
        .limit(1);
      const activePeriodId = activePeriod[0]?.id || null;

      if (existing) {
        assignmentId = existing.id;
      } else {
        const subjectTeacher = await db
          .select({ teacherId: cursoProfesores.teacherId })
          .from(cursoProfesores)
          .where(and(eq(cursoProfesores.cursoId, cursoId), eq(cursoProfesores.subjectId, subjectId)))
          .limit(1);
        const teacherId = subjectTeacher[0]?.teacherId || course.profesorId || userId;

        const [created] = await db.insert(assignments).values({
          teacherId,
          subjectId,
          cursoId,
          title: activityTitle,
          description: `Evaluacion presencial realizada en el aula fisica sobre: ${activityTitle}. Calificaciones registradas directamente.`,
          dueDate: new Date(),
          trimester: trimester || 1,
          puntos,
          periodoLectivoId: activePeriodId,
        } as any).returning();
        assignmentId = created.id;
      }

      const enrolled = await db
        .select({ id: users.id, fullName: users.fullName })
        .from(cursoEstudiantes)
        .innerJoin(users, eq(users.id, cursoEstudiantes.estudianteId))
        .where(eq(cursoEstudiantes.cursoId, cursoId));

      const results = [];
      let successCount = 0;

      for (const g of grades) {
        const student = enrolled.find(s => 
          s.fullName.toLowerCase().includes(g.fullName.toLowerCase())
        );

        if (!student) {
          results.push({ nameRequested: g.fullName, error: "Estudiante no encontrado en este curso" });
          continue;
        }

        const [existingSub] = await db
          .select({ id: assignmentSubmissions.id })
          .from(assignmentSubmissions)
          .where(and(
            eq(assignmentSubmissions.assignmentId, assignmentId),
            eq(assignmentSubmissions.studentId, student.id)
          ))
          .limit(1);

        if (existingSub) {
          await db.update(assignmentSubmissions)
            .set({
              status: "graded",
              grade: Math.round(g.grade),
              feedback: g.feedback || "Nota registrada presencialmente.",
              submittedAt: new Date(),
            } as any)
            .where(eq(assignmentSubmissions.id, existingSub.id));
        } else {
          await db.insert(assignmentSubmissions).values({
            assignmentId,
            studentId: student.id,
            status: "graded",
            grade: Math.round(g.grade),
            feedback: g.feedback || "Nota registrada presencialmente.",
            submittedAt: new Date(),
          } as any);
        }
        
        successCount++;
        results.push({ name: student.fullName, grade: g.grade, success: true });
      }

      return {
        registrado: true,
        assignmentId,
        totalProcesados: grades.length,
        totalExitosos: successCount,
        detalles: results,
        mensaje: `Se registraron calificaciones para ${successCount} estudiantes en la actividad "${activityTitle}" del curso ${course.nombre}.`,
      };
    },
  });

  return {
    getMyCourses,
    getCourseStudents,
    getStudentRisk,
    getAttendanceToday,
    getRecentAssignments,
    getPracticeAnalytics,
    generateAndCreateAssignment,
    sendMessageToStudents,
    markStudentsAbsent,
    checkAcademicLoad,
    recordPhysicalGrades,
  };
}

// ═══════════════════ ADMIN TOOLS ═══════════════════

function createAdminTools(userId: number, userFullName: string = "") {

  // ─── Consulta ───

  const getPlatformStats = tool({
    description: "Obtiene estadisticas generales: estudiantes, docentes, padres, cursos",
    inputSchema: z.object({}),
    execute: async () => {
      const [s, t, p, c] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(users).where(and(eq(users.role, "student"), eq(users.activo, true))),
        db.select({ count: sql<number>`count(*)` }).from(users).where(and(eq(users.role, "teacher"), eq(users.activo, true))),
        db.select({ count: sql<number>`count(*)` }).from(users).where(and(eq(users.role, "parent"), eq(users.activo, true))),
        db.select({ count: sql<number>`count(*)` }).from(cursos).where(eq(cursos.activo, true)),
      ]);
      return { estudiantes: s[0]?.count || 0, docentes: t[0]?.count || 0, padres: p[0]?.count || 0, cursos: c[0]?.count || 0 };
    },
  });

  const getUsersByRole = tool({
    description: "Lista todos los usuarios de un rol especifico",
    inputSchema: z.object({
      role: z.enum(["student", "teacher", "admin", "parent"]).describe("Rol a filtrar"),
      activo: z.boolean().optional().default(true).describe("Solo activos"),
    }),
    execute: async ({ role, activo }) => {
      const conds: any[] = [eq(users.role, role)];
      if (activo !== undefined) conds.push(eq(users.activo, activo));
      const result = await db.select({ id: users.id, fullName: users.fullName, cedula: users.cedula, email: users.email, activo: users.activo, createdAt: users.createdAt }).from(users).where(and(...conds)).orderBy(users.fullName).limit(50);
      return { usuarios: result, total: result.length };
    },
  });

  const getAllCourses = tool({
    description: "Lista todos los cursos con cantidad de estudiantes inscritos",
    inputSchema: z.object({}),
    execute: async () => {
      const courses = await db.select({ id: cursos.id, nombre: cursos.nombre, nivel: cursos.nivel, activo: cursos.activo }).from(cursos).orderBy(cursos.nombre);
      const result = [];
      for (const c of courses) { const enrolled = await db.select({ count: sql<number>`count(*)` }).from(cursoEstudiantes).where(eq(cursoEstudiantes.cursoId, c.id)); result.push({ ...c, estudiantes: enrolled[0]?.count || 0 }); }
      return { cursos: result, total: result.length };
    },
  });

  const getActivePeriods = tool({
    description: "Obtiene los periodos lectivos activos y recientes",
    inputSchema: z.object({}),
    execute: async () => { const periodos = await db.select().from(periodosLectivos).orderBy(desc(periodosLectivos.createdAt)).limit(5); return { periodos }; },
  });

  // ─── Acción ───

  const bulkCreateStudents = tool({
    description: "Crea varios estudiantes a la vez. Usala cuando el admin envíe un archivo con estudiantes o una lista de texto. Para cada uno se genera un PIN aleatorio de 4 digitos.",
    inputSchema: z.object({
      students: z.array(z.object({
        cedula: z.string().length(10).describe("Cedula ecuatoriana de 10 digitos"),
        fullName: z.string().min(1).describe("Nombre completo del estudiante"),
        email: z.string().optional().describe("Correo electronico opcional"),
      })).min(1).max(30).describe("Lista de estudiantes a crear"),
    }),
    execute: async ({ students }) => {
      const results: any[] = [];
      for (const s of students) {
        const [existing] = await db.select({ id: users.id, activo: users.activo }).from(users).where(eq(users.cedula, s.cedula)).limit(1);
        if (existing) {
          if (!existing.activo) {
            const pin = generatePin();
            const hashed = await bcrypt.hash(pin, 10);
            await db.update(users).set({ activo: true, fullName: s.fullName, email: s.email || null, pin: hashed }).where(eq(users.id, existing.id));
            results.push({ cedula: s.cedula, fullName: s.fullName, pin, reactivado: true });
          } else {
            results.push({ cedula: s.cedula, fullName: s.fullName, error: "Ya existe" });
          }
        } else {
          const pin = generatePin();
          const hashed = await bcrypt.hash(pin, 10);
          await db.insert(users).values({ cedula: s.cedula, fullName: s.fullName, role: "student", email: s.email || null, pin: hashed } as any);
          results.push({ cedula: s.cedula, fullName: s.fullName, pin, creado: true });
        }
      }
      const creados = results.filter((r: any) => r.creado || r.reactivado).length;
      return { resultados: results, total_creados: creados, mensaje: `Se procesaron ${students.length} estudiantes: ${creados} creados/reactivados.` };
    },
  });

  const createCourse = tool({
    description: "Crea un curso nuevo en la plataforma. Opcionalmente asigna un profesor.",
    inputSchema: z.object({
      nombre: z.string().describe("Nombre del curso, ej: 'Matemáticas Avanzadas'"),
      nivel: z.string().describe("Nivel o paralelo, ej: '3ro BGU'"),
      profesorId: z.number().optional().describe("ID del profesor a cargo del curso"),
    }),
    execute: async ({ nombre, nivel, profesorId }) => {
      const [curso] = await db.insert(cursos).values({
        nombre,
        nivel,
        profesorId: profesorId || null,
        activo: true,
      } as any).returning();
      return { curso, mensaje: `Curso '${nombre}' (${nivel}) creado exitosamente con ID ${curso.id}.` };
    },
  });

  const enrollStudentsToCourse = tool({
    description: "Inscribe una lista de estudiantes (identificados por cédula) a un curso existente.",
    inputSchema: z.object({
      cursoId: z.number().describe("ID del curso"),
      cedulas: z.array(z.string()).describe("Lista de cédulas de los estudiantes a inscribir"),
    }),
    execute: async ({ cursoId, cedulas }) => {
      const [curso] = await db.select({ id: cursos.id, nombre: cursos.nombre }).from(cursos).where(eq(cursos.id, cursoId)).limit(1);
      if (!curso) return { error: "Curso no encontrado" };

      const students = await db.select({ id: users.id, cedula: users.cedula }).from(users).where(inArray(users.cedula, cedulas));
      if (students.length === 0) return { error: "No se encontró ningún estudiante con esas cédulas." };

      let enrolled = 0;
      for (const s of students) {
        try {
          await db.insert(cursoEstudiantes).values({ cursoId: curso.id, estudianteId: s.id } as any).onConflictDoNothing();
          enrolled++;
        } catch (e) {}
      }

      return {
        inscritos: enrolled,
        total_solicitados: cedulas.length,
        mensaje: `Se inscribieron ${enrolled} estudiantes al curso '${curso.nombre}'.`
      };
    },
  });

  const sendCredentialsToCourse = tool({
    description: "Envia por correo electronico las credenciales (cedula y PIN) a todos los estudiantes de un curso que tengan email registrado. Opcionalmente puede regenerar los PINs.",
    inputSchema: z.object({
      cursoId: z.number().describe("ID del curso"),
      resetPins: z.boolean().optional().default(false).describe("Si es true, regenera los PINs antes de enviar"),
    }),
    execute: async ({ cursoId, resetPins }) => {
      const smtpConfig = await getSmtpConfig();
      if (!smtpConfig) return { error: "SMTP no configurado. El admin debe configurar SMTP en Configuracion primero." };

      const [curso] = await db.select({ nombre: cursos.nombre, nivel: cursos.nivel }).from(cursos).where(eq(cursos.id, cursoId)).limit(1);
      if (!curso) return { error: "Curso no encontrado" };

      const enrolled = await db
        .select({ id: users.id, cedula: users.cedula, fullName: users.fullName, email: users.email })
        .from(cursoEstudiantes)
        .innerJoin(users, eq(cursoEstudiantes.estudianteId, users.id))
        .where(eq(cursoEstudiantes.cursoId, cursoId));

      const withEmail = enrolled.filter(s => s.email);
      if (withEmail.length === 0) return { error: "Ningun estudiante de este curso tiene email registrado" };

      const pinsByStudent: Record<number, string> = {};
      if (resetPins) {
        for (const s of withEmail) {
          const pin = generatePin();
          const hashed = await bcrypt.hash(pin, 10);
          await db.update(users).set({ pin: hashed }).where(eq(users.id, s.id));
          pinsByStudent[s.id] = pin;
        }
      }

      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.default.createTransport({ host: smtpConfig.host, port: smtpConfig.port, secure: smtpConfig.port === 465, auth: { user: smtpConfig.user, pass: smtpConfig.pass } });
      const from = `${smtpConfig.fromName} <${smtpConfig.user}>`;

      let sent = 0;
      for (const s of withEmail) {
        if (!s.email) continue;
        const pin = resetPins ? pinsByStudent[s.id] : undefined;
        try {
          await transporter.sendMail({
            from, to: s.email,
            subject: `Credenciales Atlas Edu - ${curso.nombre}`,
            html: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;"><h2 style="color:#1a2332;">Atlas Edu - Credenciales</h2><p>Hola <strong>${s.fullName}</strong>,</p><p>Has sido registrado en <strong>${curso.nombre} (${curso.nivel})</strong>.</p><div style="background:#f0f4f8;padding:16px;border-radius:8px;margin:16px 0;"><p><strong>Usuario:</strong> ${s.cedula}</p>${pin ? `<p><strong>PIN:</strong> <span style="font-size:18px;letter-spacing:4px;">${pin}</span></p>` : `<p><strong>PIN:</strong> Entregado por el administrador.</p>`}</div><p>Accede en atlas.edu con tu cedula y PIN.</p></div>`,
          });
          sent++;
        } catch (err) { console.error("Email failed:", err); }
      }

      return {
        enviados: sent,
        total: withEmail.length,
        curso: curso.nombre,
        pins_regenerados: resetPins,
        mensaje: `Se enviaron credenciales a ${sent} de ${withEmail.length} estudiantes de ${curso.nombre}${resetPins ? " con nuevos PINs" : ""}.`,
      };
    },
  });

  const checkAcademicLoad = tool({
    description: "Verifica la carga academica de un curso o nivel para ver si los estudiantes tienen demasiadas tareas acumuladas. Muestra las tareas programadas con sus fechas de entrega.",
    inputSchema: z.object({
      cursoId: z.number().optional().describe("ID del curso especifico"),
      nivel: z.string().optional().describe("Nivel o paralelo, ej: '3ro BGU', '2do BGU'"),
      daysAhead: z.number().optional().default(7).describe("Cantidad de dias a revisar hacia el futuro"),
    }),
    execute: async ({ cursoId, nivel, daysAhead }) => {
      let courseIds: number[] = [];
      if (cursoId) {
        courseIds = [cursoId];
      } else if (nivel) {
        const matchingCourses = await db
          .select({ id: cursos.id })
          .from(cursos)
          .where(and(eq(cursos.activo, true), sql`lower(${cursos.nivel}) LIKE ${`%${nivel.toLowerCase()}%`}`));
        courseIds = matchingCourses.map(c => c.id);
      } else {
        return { error: "Debe proporcionar cursoId o nivel" };
      }

      if (courseIds.length === 0) {
        return { tareas: [], mensaje: "No se encontraron cursos activos para este criterio." };
      }

      const now = new Date();
      const futureLimit = new Date();
      futureLimit.setDate(now.getDate() + (daysAhead || 7));

      const tasks = await db
        .select({
          id: assignments.id,
          title: assignments.title,
          dueDate: assignments.dueDate,
          subjectName: subjects.name,
          cursoNombre: cursos.nombre,
          nivel: cursos.nivel,
        })
        .from(assignments)
        .innerJoin(cursos, eq(cursos.id, assignments.cursoId))
        .innerJoin(subjects, eq(subjects.id, assignments.subjectId))
        .where(
          and(
            inArray(sql`${assignments.cursoId}::int`, courseIds),
            sql`${assignments.dueDate} >= ${now} AND ${assignments.dueDate} <= ${futureLimit}`
          )
        )
        .orderBy(assignments.dueDate);

      return {
        tareas: tasks,
        total: tasks.length,
        mensaje: `Se encontraron ${tasks.length} tareas programadas para los proximos ${daysAhead} dias en los cursos seleccionados.`,
      };
    },
  });

  const createExamTemplate = tool({
    description: "Genera una plantilla de examen (borrador) con IA para todos los cursos de un nivel (ej: 3ro BGU) y materia. Recupera el curriculo/modulos de la base de datos para armar preguntas relevantes.",
    inputSchema: z.object({
      nivel: z.string().describe("Nivel escolar para aplicar el examen, ej: '3ro BGU', '1ro BGU'"),
      subjectId: z.number().describe("ID de la materia a evaluar"),
      trimester: z.number().optional().default(1).describe("Trimestre de la evaluacion (1, 2 o 3)"),
      evaluationType: z.enum(["parcial_1", "parcial_2", "examen_trimestral"]).describe("Tipo de evaluacion de acuerdo a como se evalua en Ecuador"),
      questionCount: z.number().optional().default(10).describe("Cantidad de preguntas a generar (5-15)"),
      puntos: z.number().optional().default(10).describe("Puntaje maximo del examen"),
    }),
    execute: async ({ nivel, subjectId, trimester, evaluationType, questionCount, puntos }) => {
      const subjectData = await db.select({ name: subjects.name }).from(subjects).where(eq(subjects.id, subjectId)).limit(1);
      if (subjectData.length === 0) return { error: "Materia no encontrada" };
      const subjectName = subjectData[0].name;

      const dbModules = await db
        .select({ title: modules.title, topic: modules.topic })
        .from(modules)
        .where(eq(modules.subjectId, subjectId))
        .orderBy(modules.order);
      
      const syllabusText = dbModules.length > 0
        ? dbModules.map((m, i) => `Modulo ${i + 1}: ${m.title} (${m.topic || ""})`).join("\n")
        : "No hay modulos registrados aun en el sistema para esta materia.";

      const count = Math.min(Math.max(5, questionCount || 10), 15);

      const aiPrompt = `Eres un docente experto en Ecuador creando evaluaciones escritas para educacion acelerada de adultos (PCEI). Genera una plantilla de examen en JSON.

Materia: ${subjectName}
Temario Real del Curso:
${syllabusText}

Tipo de Evaluacion: ${evaluationType} (Trimestre: ${trimester})
Cantidad de preguntas: ${count}

REGLAS DE EVALUACION:
- Para un examen de fin de trimestre ("examen_trimestral"), las preguntas deben cubrir todos los modulos de forma acumulativa y balanceada.
- Para una evaluacion parcial ("parcial_1" o "parcial_2"), concentrate en los primeros o segundos modulos del temario respectivamente.
- Preguntas: Genera una mezcla de preguntas de opcion multiple (tipo "mcq") y preguntas de desarrollo/respuestas cortas (tipo "file_upload" pero formuladas como pregunta abierta para que escriban su respuesta fisica).
- Cada pregunta de opcion multiple (mcq) debe tener 4 opciones con un "correctIndex" (0-3).
- SOLO responde con JSON puro. Empieza con { y termina con }. Sin bloques de codigo markdown.

FORMATO JSON:
{
  "title": "...",
  "description": "...",
  "questions": [
    { "type": "mcq", "question": "...", "options": ["A","B","C","D"], "correctIndex": 0, "points": 1 },
    { "type": "file_upload", "question": "...", "points": 2 }
  ]
}`;

      const start = Date.now();
      const aiResult = await generateText({ model: opencodeGoModel, prompt: aiPrompt, temperature: 0.5, maxOutputTokens: 8000 });
      logAiCall({ route: "ai-tool/generate-exam-template", model: "kimi-k2.5", durationMs: Date.now() - start, usage: aiResult.usage ? { inputTokens: aiResult.usage.inputTokens, outputTokens: aiResult.usage.outputTokens, totalTokens: (aiResult.usage.inputTokens ?? 0) + (aiResult.usage.outputTokens ?? 0) } : undefined });

      let text = aiResult.text || "";
      text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        return { error: "La IA no pudo generar el examen en formato valido. Intenta nuevamente o ajusta los parametros." };
      }

      const targetCourses = await db
        .select({ id: cursos.id, profesorId: cursos.profesorId, nombre: cursos.nombre })
        .from(cursos)
        .where(and(eq(cursos.activo, true), sql`lower(${cursos.nivel}) LIKE ${`%${nivel.toLowerCase()}%`}`));

      if (targetCourses.length === 0) {
        return { error: `No se encontraron cursos activos para el nivel "${nivel}"` };
      }

      const activePeriod = await db
        .select({ id: periodosLectivos.id })
        .from(periodosLectivos)
        .where(eq(periodosLectivos.activo, true))
        .limit(1);
      const activePeriodId = activePeriod[0]?.id || null;

      const createdAssignments = [];

      for (const course of targetCourses) {
        const subjectTeacher = await db
          .select({ teacherId: cursoProfesores.teacherId })
          .from(cursoProfesores)
          .where(and(eq(cursoProfesores.cursoId, course.id), eq(cursoProfesores.subjectId, subjectId)))
          .limit(1);
        
        const teacherId = subjectTeacher[0]?.teacherId || course.profesorId;
        if (!teacherId) continue;

        const [assignment] = await db.insert(assignments).values({
          teacherId,
          subjectId,
          cursoId: course.id,
          title: `[PLANTILLA] ${data.title || "Examen"}`,
          description: data.description || "Plantilla de examen generada.",
          trimester,
          puntos,
          periodoLectivoId: activePeriodId,
        } as any).returning();

        const questions = (data.questions || []).slice(0, 20);
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          await db.insert(assignmentQuestions).values({
            assignmentId: assignment.id,
            type: q.type === "file_upload" ? "file_upload" : "mcq",
            question: q.question || "",
            options: q.type === "file_upload" ? undefined : (q.options || []),
            correctIndex: q.type === "file_upload" ? undefined : (q.correctIndex ?? 0),
            points: q.points || 1,
            orderIndex: i,
          } as any);
        }

        createdAssignments.push({
          curso: course.nombre,
          tareaId: assignment.id,
          teacherId,
        });
      }

      return {
        creado: true,
        totalCursos: createdAssignments.length,
        detalles: createdAssignments,
        mensaje: `Plantilla de examen "${data.title}" creada y guardada como borrador para ${createdAssignments.length} paralelos del nivel "${nivel}".`,
      };
    },
  });

  const recordPhysicalGrades = tool({
    description: "Registra en bloque calificaciones para una actividad fisica o presencial (ej: exposiciones, lecciones fisicas, participacion) en un curso. Crea la tarea si no existe.",
    inputSchema: z.object({
      cursoId: z.number().describe("ID del curso al que pertenecen los alumnos"),
      subjectId: z.number().describe("ID de la materia"),
      activityTitle: z.string().describe("Titulo de la actividad fisica, ej: 'Exposicion de Historia', 'Leccion 1'"),
      puntos: z.number().optional().default(10).describe("Puntaje maximo de la actividad"),
      trimester: z.number().optional().default(1).describe("Trimestre al que pertenece la actividad (1, 2 o 3)"),
      grades: z.array(z.object({
        fullName: z.string().describe("Nombre o apellido del estudiante (busqueda flexible)"),
        grade: z.number().describe("Nota obtenida (ej: 0 a 10)"),
        feedback: z.string().optional().describe("Comentario de retroalimentacion"),
      })).min(1).describe("Listado de estudiantes y sus calificaciones"),
    }),
    execute: async ({ cursoId, subjectId, activityTitle, puntos, trimester, grades }) => {
      const [course] = await db.select({ nombre: cursos.nombre, profesorId: cursos.profesorId }).from(cursos).where(eq(cursos.id, cursoId)).limit(1);
      if (!course) return { error: "Curso no encontrado" };

      let assignmentId: number;
      const [existing] = await db
        .select({ id: assignments.id })
        .from(assignments)
        .where(and(eq(assignments.cursoId, cursoId), eq(assignments.subjectId, subjectId), eq(assignments.title, activityTitle)))
        .limit(1);
      
      const activePeriod = await db
        .select({ id: periodosLectivos.id })
        .from(periodosLectivos)
        .where(eq(periodosLectivos.activo, true))
        .limit(1);
      const activePeriodId = activePeriod[0]?.id || null;

      if (existing) {
        assignmentId = existing.id;
      } else {
        const subjectTeacher = await db
          .select({ teacherId: cursoProfesores.teacherId })
          .from(cursoProfesores)
          .where(and(eq(cursoProfesores.cursoId, cursoId), eq(cursoProfesores.subjectId, subjectId)))
          .limit(1);
        const teacherId = subjectTeacher[0]?.teacherId || course.profesorId || userId;

        const [created] = await db.insert(assignments).values({
          teacherId,
          subjectId,
          cursoId,
          title: activityTitle,
          description: `Evaluacion presencial realizada en el aula fisica sobre: ${activityTitle}. Calificaciones registradas directamente.`,
          dueDate: new Date(),
          trimester: trimester || 1,
          puntos,
          periodoLectivoId: activePeriodId,
        } as any).returning();
        assignmentId = created.id;
      }

      const enrolled = await db
        .select({ id: users.id, fullName: users.fullName })
        .from(cursoEstudiantes)
        .innerJoin(users, eq(users.id, cursoEstudiantes.estudianteId))
        .where(eq(cursoEstudiantes.cursoId, cursoId));

      const results = [];
      let successCount = 0;

      for (const g of grades) {
        const student = enrolled.find(s => 
          s.fullName.toLowerCase().includes(g.fullName.toLowerCase())
        );

        if (!student) {
          results.push({ nameRequested: g.fullName, error: "Estudiante no encontrado en este curso" });
          continue;
        }

        const [existingSub] = await db
          .select({ id: assignmentSubmissions.id })
          .from(assignmentSubmissions)
          .where(and(
            eq(assignmentSubmissions.assignmentId, assignmentId),
            eq(assignmentSubmissions.studentId, student.id)
          ))
          .limit(1);

        if (existingSub) {
          await db.update(assignmentSubmissions)
            .set({
              status: "graded",
              grade: Math.round(g.grade),
              feedback: g.feedback || "Nota registrada presencialmente.",
              submittedAt: new Date(),
            } as any)
            .where(eq(assignmentSubmissions.id, existingSub.id));
        } else {
          await db.insert(assignmentSubmissions).values({
            assignmentId,
            studentId: student.id,
            status: "graded",
            grade: Math.round(g.grade),
            feedback: g.feedback || "Nota registrada presencialmente.",
            submittedAt: new Date(),
          } as any);
        }
        
        successCount++;
        results.push({ name: student.fullName, grade: g.grade, success: true });
      }

      return {
        registrado: true,
        assignmentId,
        totalProcesados: grades.length,
        totalExitosos: successCount,
        detalles: results,
        mensaje: `Se registraron calificaciones para ${successCount} estudiantes en la actividad "${activityTitle}" del curso ${course.nombre}.`,
      };
    },
  });

  return {
    getPlatformStats,
    getUsersByRole,
    getAllCourses,
    getActivePeriods,
    bulkCreateStudents,
    createCourse,
    enrollStudentsToCourse,
    sendCredentialsToCourse,
    checkAcademicLoad,
    createExamTemplate,
    recordPhysicalGrades,
  };
}

// ═══════════════════ EXPORT ═══════════════════

export function getToolsForRole(role: string, userId: number, userFullName: string = "") {
  if (role === "admin") return createAdminTools(userId, userFullName);
  return createTeacherTools(userId, userFullName);
}
