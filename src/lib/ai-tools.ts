import { tool } from "ai";
import { z } from "zod/v4";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import {
  users, subjects, progress, cursos, cursoEstudiantes,
  cursoProfesores, assignments, assignmentSubmissions,
  assignmentQuestions, practiceSessions, asistencia,
  periodosLectivos, directMessages, modules,
  cuestionarios, cuestionarioPreguntas, studyMaterials,
} from "@/lib/db/schema";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { opencodeGoModel, logAiCall, DEFAULT_MODEL_ID, tryParseJson } from "@/lib/ai";
import { generateText } from "ai";
import { getSmtpConfig } from "@/lib/smtp-config";
import { notifyUser, notifyStudentsInCourse } from "@/lib/notifications";
import { getTeacherCourseIds } from "@/lib/course-helpers";

function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

const ASSIGNMENT_KEY_MAP: Record<string, string> = {
  titulo: "title",
  title: "title",
  descripcion: "description",
  description: "description",
  preguntas: "questions",
  questions: "questions",
  tipo: "type",
  type: "type",
  pregunta: "question",
  question: "question",
  opciones: "options",
  options: "options",
  indicecorrecto: "correctIndex",
  correctindex: "correctIndex",
  puntos: "points",
  points: "points",
};

function normalizeAssignmentKeys(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map(normalizeAssignmentKeys);
  }
  const result: any = {};
  for (const key of Object.keys(obj)) {
    const cleanKey = key
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/_/g, "")
      .replace(/\s+/g, "");
    const targetKey = ASSIGNMENT_KEY_MAP[cleanKey] || cleanKey;
    result[targetKey] = normalizeAssignmentKeys(obj[key]);
  }
  return result;
}

function normalizeQuestionItem(val: any): any {
  if (!val || typeof val !== "object") return val;
  let typeVal = String(val.type ?? "").toLowerCase();
  if (typeVal.includes("complet") || typeVal.includes("blanco") || typeVal.includes("llenar")) {
    val.type = "completar";
  } else if (typeVal.includes("opcion") || typeVal.includes("multiple") || typeVal.includes("mcq")) {
    val.type = "mcq";
  } else if (typeVal.includes("upload") || typeVal.includes("archivo") || typeVal.includes("subir")) {
    val.type = "file_upload";
  }
  
  if (val.pregunta && !val.question) val.question = val.pregunta;
  if (val.opciones && !val.options) val.options = val.opciones;
  if ((val.indicecorrecto || val.correctindex) && val.correctIndex === undefined) {
    val.correctIndex = val.indicecorrecto ?? val.correctindex;
  }
  if ((val.puntos || val.points) && val.points === undefined) {
    val.points = val.puntos ?? val.points;
  }
  if (val.points !== undefined && val.points !== null) {
    val.points = Number(val.points);
  }
  if (val.correctIndex !== undefined && val.correctIndex !== null) {
    val.correctIndex = Number(val.correctIndex);
  }
  return val;
}

// ═══════════════════ TEACHER TOOLS ═══════════════════

function createTeacherTools(userId: number, userFullName: string) {

  // ─── Consulta ───

  const getMyCourses = tool({
    description: "Obtiene la lista de cursos que imparte o tutoriza el docente actual, incluyendo las materias que dicta en cada curso",
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
      const courseIds = all.map(c => c.id);
      const subjectsMap: Record<number, { id: number; name: string; slug: string }[]> = {};
      if (courseIds.length > 0) {
        const cp = await db
          .select({
            cursoId: cursoProfesores.cursoId,
            subjectId: subjects.id,
            subjectName: subjects.name,
            subjectSlug: subjects.slug,
          })
          .from(cursoProfesores)
          .innerJoin(subjects, eq(cursoProfesores.subjectId, subjects.id))
          .where(and(eq(cursoProfesores.teacherId, userId), inArray(cursoProfesores.cursoId, courseIds)));
        for (const row of cp) {
          if (!subjectsMap[row.cursoId]) subjectsMap[row.cursoId] = [];
          subjectsMap[row.cursoId].push({ id: row.subjectId, name: row.subjectName, slug: row.subjectSlug });
        }
      }
      const cursosConMaterias = all.map(c => ({ ...c, materias: subjectsMap[c.id] || [] }));
      return { cursos: cursosConMaterias, total: all.length };
    },
  });

  const searchSubject = tool({
    description: "Busca materias por nombre o palabra clave. Devuelve el ID, nombre y slug de las materias que coinciden. Usala cuando el docente mencione una materia (ej: matematicas, fisica, ingles) para obtener su ID.",
    inputSchema: z.object({ query: z.string().describe("Nombre o parte del nombre de la materia a buscar, ej: matematicas, fisica, quimica") }),
    execute: async ({ query }) => {
      const result = await db
        .select({ id: subjects.id, name: subjects.name, slug: subjects.slug, emoji: subjects.emoji })
        .from(subjects)
        .where(sql`lower(${subjects.name}) LIKE ${`%${query.toLowerCase()}%`}`)
        .orderBy(subjects.name);
      return { materias: result, total: result.length };
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
    description: "Identifica estudiantes en riesgo academico segun sus calificaciones, tareas pendientes y actividad. Criterios: promedio menor a 7, 3+ tareas sin entregar, o 14+ dias inactivo.",
    inputSchema: z.object({
      cursoId: z.number().optional().describe("ID del curso. Si se omite, busca en todos los cursos del docente"),
    }),
    execute: async ({ cursoId }) => {
      let courseIds: number[];
      if (cursoId) {
        courseIds = [cursoId];
      } else {
        courseIds = await getTeacherCourseIds(userId);
      }

      if (courseIds.length === 0) return { en_riesgo: [], total: 0, criterio: "Promedio < 7, 3+ pendientes, o 14+ inactivo" };

      const enrolled = await db
        .select({ id: users.id, fullName: users.fullName, cedula: users.cedula })
        .from(users)
        .innerJoin(cursoEstudiantes, eq(cursoEstudiantes.estudianteId, users.id))
        .where(and(eq(users.role, "student"), eq(users.activo, true), inArray(cursoEstudiantes.cursoId, courseIds)));

      const studentIds = [...new Set(enrolled.map(e => e.id))];
      if (studentIds.length === 0) return { en_riesgo: [], total: 0, criterio: "Promedio < 7, 3+ pendientes, o 14+ inactivo" };

      const teacherAssignments = await db
        .select({ id: assignments.id, subjectName: subjects.name, subjectEmoji: subjects.emoji })
        .from(assignments)
        .innerJoin(subjects, eq(subjects.id, assignments.subjectId))
        .where(and(eq(assignments.teacherId, userId), inArray(assignments.cursoId, courseIds)));

      const assignmentIds = teacherAssignments.map(a => a.id);
      const totalAssignments = assignmentIds.length;

      const submissions = assignmentIds.length > 0 ? await db
        .select({ studentId: assignmentSubmissions.studentId, grade: assignmentSubmissions.grade, status: assignmentSubmissions.status, submittedAt: assignmentSubmissions.submittedAt, assignmentId: assignmentSubmissions.assignmentId })
        .from(assignmentSubmissions)
        .where(and(inArray(assignmentSubmissions.studentId, studentIds), inArray(assignmentSubmissions.assignmentId, assignmentIds))) : [];

      const subsByStudent = new Map<number, typeof submissions>();
      for (const sub of submissions) {
        const arr = subsByStudent.get(sub.studentId) ?? [];
        arr.push(sub);
        subsByStudent.set(sub.studentId, arr);
      }

      const now = Date.now();
      const enRiesgo = [];

      for (const s of enrolled) {
        const subs = subsByStudent.get(s.id) ?? [];
        const graded = subs.filter(sub => sub.grade !== null);
        const pending = totalAssignments - subs.length;
        const lastSub = subs.reduce<string | null>((latest, sub) =>
          sub.submittedAt && (!latest || new Date(sub.submittedAt) > new Date(latest)) ? new Date(sub.submittedAt).toISOString() : latest, null);
        const daysInactive = lastSub ? Math.floor((now - new Date(lastSub).getTime()) / (1000 * 60 * 60 * 24)) : 999;
        const avgGrade = graded.length > 0 ? graded.reduce((sum, sub) => sum + (sub.grade ?? 0), 0) / graded.length : null;
        const isFailing = avgGrade !== null && avgGrade < 7;
        const hasPending = pending >= 3;
        const isInactive = daysInactive >= 14;

        if (isFailing || hasPending || isInactive) {
          enRiesgo.push({
            id: s.id,
            fullName: s.fullName,
            cedula: s.cedula,
            consecutiveFailures: pending,
            daysInactive,
            subjectName: totalAssignments > 0 ? teacherAssignments[0].subjectName : "General",
          });
        }
      }

      return { en_riesgo: enRiesgo, total: enRiesgo.length, criterio: "Promedio < 7, 3+ pendientes, o 14+ inactivo" };
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
      const assignmentIds = tareas.map(t => t.id);
      const allSubs = assignmentIds.length > 0
        ? await db.select({ id: assignmentSubmissions.id, assignmentId: assignmentSubmissions.assignmentId, status: assignmentSubmissions.status }).from(assignmentSubmissions).where(inArray(assignmentSubmissions.assignmentId, assignmentIds))
        : [];
      const subsByAssignment = new Map<number, typeof allSubs>();
      for (const s of allSubs) {
        const arr = subsByAssignment.get(s.assignmentId) ?? [];
        arr.push(s);
        subsByAssignment.set(s.assignmentId, arr);
      }
      const result = tareas.map(t => {
        const subs = subsByAssignment.get(t.id) ?? [];
        return { ...t, entregadas: subs.filter(s => s.status === "submitted" || s.status === "graded").length, pendientes: subs.filter(s => s.status === "pending").length };
      });
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

  const searchAssignments = tool({
    description: "Busca tareas por nombre o tema. Retorna lista con IDs para usar en otras operaciones. Util cuando el usuario menciona 'la tarea de...' o 'el examen de...' sin especificar ID.",
    inputSchema: z.object({
      query: z.string().describe("Texto a buscar en titulo o tema de la tarea"),
      cursoId: z.number().optional().describe("Filtrar por curso especifico"),
      limit: z.number().optional().default(10).describe("Maximo de resultados (default 10)"),
    }),
    execute: async ({ query, cursoId, limit }) => {
      const conds: any[] = [eq(assignments.teacherId, userId)];
      
      if (cursoId) {
        conds.push(eq(assignments.cursoId, cursoId));
      }
      
      if (query) {
        conds.push(sql`lower(${assignments.title}) LIKE ${`%${query.toLowerCase()}%`}`);
      }

      const results = await db
        .select({
          id: assignments.id,
          title: assignments.title,
          cursoNombre: cursos.nombre,
          nivel: cursos.nivel,
          subjectName: subjects.name,
          subjectEmoji: subjects.emoji,
          trimester: assignments.trimester,
          dueDate: assignments.dueDate,
          puntos: assignments.puntos,
        })
        .from(assignments)
        .leftJoin(cursos, eq(cursos.id, assignments.cursoId))
        .leftJoin(subjects, eq(subjects.id, assignments.subjectId))
        .where(and(...conds))
        .orderBy(desc(assignments.createdAt))
        .limit(limit || 10);

      return { tareas: results, total: results.length };
    },
  });

  const searchStudents = tool({
    description: "Busca estudiantes por nombre o cedula en los cursos del docente. Util cuando el usuario menciona 'el estudiante Juan' o 'busca al alumno con cedula...'",
    inputSchema: z.object({
      query: z.string().describe("Nombre o cedula del estudiante a buscar"),
      cursoId: z.number().optional().describe("Filtrar por curso especifico"),
      limit: z.number().optional().default(20).describe("Maximo de resultados (default 20)"),
    }),
    execute: async ({ query, cursoId, limit }) => {
      let studentIds: number[] = [];
      if (cursoId) {
        const enrolled = await db
          .select({ estudianteId: cursoEstudiantes.estudianteId })
          .from(cursoEstudiantes)
          .where(eq(cursoEstudiantes.cursoId, cursoId));
        studentIds = enrolled.map(e => e.estudianteId);
      }

      const conds: any[] = [eq(users.role, "student"), eq(users.activo, true)];
      if (studentIds.length > 0) {
        conds.push(inArray(users.id, studentIds));
      }
      if (query) {
        if (/^\d+$/.test(query)) {
          conds.push(eq(users.cedula, query));
        } else {
          conds.push(sql`lower(${users.fullName}) LIKE ${`%${query.toLowerCase()}%`}`);
        }
      }

      const results = await db
        .select({
          id: users.id,
          fullName: users.fullName,
          cedula: users.cedula,
          email: users.email,
        })
        .from(users)
        .where(and(...conds))
        .limit(limit || 20);

      let coursesInfo: any[] = [];
      if (results.length > 0) {
        const userIds = results.map(r => r.id);
        const enrollments = await db
          .select({
            studentId: cursoEstudiantes.estudianteId,
            cursoNombre: cursos.nombre,
            nivel: cursos.nivel,
          })
          .from(cursoEstudiantes)
          .innerJoin(cursos, eq(cursos.id, cursoEstudiantes.cursoId))
          .where(inArray(cursoEstudiantes.estudianteId, userIds));

        coursesInfo = results.map(r => ({
          id: r.id,
          cursos: enrollments.filter(e => e.studentId === r.id).map(e => ({ nombre: e.cursoNombre, nivel: e.nivel })),
        }));
      }

      return {
        estudiantes: results,
        total: results.length,
        cursos_por_estudiante: coursesInfo,
      };
    },
  });

  const getPendingGrades = tool({
    description: "Consulta tareas que tienen submissions sin calificar (status submitted o pending sin grade). Ideal para preguntar 'que tareas tienen pendientes de calificar' o antes de usar batchGradeSubmissions.",
    inputSchema: z.object({
      cursoId: z.number().optional().describe("Filtrar por curso especifico"),
    }),
    execute: async ({ cursoId }) => {
      const conds: any[] = [eq(assignments.teacherId, userId)];
      if (cursoId) conds.push(eq(assignments.cursoId, cursoId));

      const teacherAssignments = await db
        .select({
          id: assignments.id,
          title: assignments.title,
          cursoId: assignments.cursoId,
          cursoNombre: cursos.nombre,
          nivel: cursos.nivel,
          subjectName: subjects.name,
          subjectEmoji: subjects.emoji,
          trimester: assignments.trimester,
          puntos: assignments.puntos,
          createdAt: assignments.createdAt,
        })
        .from(assignments)
        .leftJoin(cursos, eq(cursos.id, assignments.cursoId))
        .leftJoin(subjects, eq(subjects.id, assignments.subjectId))
        .where(and(...conds))
        .orderBy(desc(assignments.createdAt))
        .limit(20);

      const assignmentIds = teacherAssignments.map(a => a.id);
      const allSubmissions = assignmentIds.length > 0
        ? await db
            .select({
              id: assignmentSubmissions.id,
              assignmentId: assignmentSubmissions.assignmentId,
              studentId: assignmentSubmissions.studentId,
              status: assignmentSubmissions.status,
              grade: assignmentSubmissions.grade,
              studentName: users.fullName,
            })
            .from(assignmentSubmissions)
            .innerJoin(users, eq(users.id, assignmentSubmissions.studentId))
            .where(inArray(assignmentSubmissions.assignmentId, assignmentIds))
        : [];
      const subsByAssignment = new Map<number, typeof allSubmissions>();
      for (const sub of allSubmissions) {
        const arr = subsByAssignment.get(sub.assignmentId) ?? [];
        arr.push(sub);
        subsByAssignment.set(sub.assignmentId, arr);
      }

      const results = [];
      for (const assignment of teacherAssignments) {
        const submissions = subsByAssignment.get(assignment.id) ?? [];
        const pending = submissions.filter(s => (s.status === "submitted" || s.status === "pending") && s.grade === null);
        const graded = submissions.filter(s => s.grade !== null);

        if (pending.length > 0) {
          results.push({
            id: assignment.id,
            title: assignment.title,
            cursoNombre: assignment.cursoNombre || "Sin curso",
            nivel: assignment.nivel || "",
            subjectName: assignment.subjectName || "",
            subjectEmoji: assignment.subjectEmoji || "",
            trimester: assignment.trimester,
            puntos: assignment.puntos,
            total_entregados: submissions.length,
            calificados: graded.length,
            pendientes: pending.length,
            estudiantes_pendientes: pending.map(p => p.studentName),
          });
        }
      }

      return {
        tareas_con_pendientes: results,
        total_tareas: results.length,
        mensaje: results.length > 0
          ? `Encontradas ${results.length} tareas con estudiantes sin calificar.`
          : "No hay tareas con entregas pendientes de calificar.",
      };
    },
  });

  const getFeatureGuide = tool({
    description: "Obtiene guia paso a paso de una funcionalidad de la plataforma. Retorna URL de la pagina, pasos a seguir, y consejos. Usala cuando el usuario pregunte 'como hago X' o 'como usar Y'.",
    inputSchema: z.object({
      feature: z.enum([
        "attendance",
        "assignments",
        "grades",
        "create_assignment",
        "grade_submissions",
        "import_students",
        "create_course",
        "send_credentials",
        "schedule",
        "report_cards",
        "smtp_config",
        "analytics",
        "student_risk",
      ]).describe("Caracteristica de la plataforma"),
    }),
    execute: async ({ feature }) => {
      const guides: Record<string, any> = {
        attendance: {
          titulo: "Tomar Asistencia",
          url: "/teacher/asistencia",
          pasos: [
            "Ve a Teacher > Asistencia en el menu lateral",
            "Selecciona el curso en el dropdown superior",
            "Usa las flechas < > para navegar fechas",
            "Click en cada estudiante para ciclar estado: Presente → Ausente → Tardanza → Justificado",
            "Usa 'Marcar todos presentes' si todos llegaron",
            "Click 'Guardar' para registrar la asistencia",
          ],
          consejos: [
            "Puedes cambiar la fecha para tomar asistencia de dias anteriores",
            "El estado 'Justificado' es para ausencias aprobadas",
            "Los cambios se guardan automaticamente al cambiar de fecha",
          ],
          aiHelp: "Di 'registra presentes a los de [curso] hoy' y la IA lo hace por ti",
        },
        assignments: {
          titulo: "Ver y Gestionar Tareas",
          url: "/teacher/assignments",
          pasos: [
            "Ve a Teacher > Tareas en el menu lateral",
            "Veras la lista de todas tus tareas con estado",
            "Click en una tarea para ver entregas y calificar",
            "Usa el boton 'Nueva Tarea' para crear",
            "Filtra por curso o busca por nombre",
          ],
          consejos: [
            "Las tareas con estudiantes pendientes tienen badge naranja",
            "Puedes editar o eliminar tareas desde la lista",
          ],
          aiHelp: "Di 'crea una tarea de [tema] para [curso]' y la IA la genera",
        },
        create_assignment: {
          titulo: "Crear Nueva Tarea",
          url: "/teacher/assignments",
          pasos: [
            "Ve a Teacher > Tareas",
            "Click 'Nueva Tarea'",
            "Llena: Titulo, Descripcion, Materia, Curso (opcional)",
            "Selecciona fecha de entrega y trimestre (1, 2 o 3)",
            "Agrega preguntas: tipo MCQ (4 opciones) o Archivo (instrucciones)",
            "Define puntos maximos (default 10)",
            "Guardar",
          ],
          consejos: [
            "Usa 'Generar con IA' para crear preguntas automaticamente",
            "Las preguntas MCQ tienen 4 opciones con una correcta",
            "Las preguntas de archivo piden al estudiante subir un documento",
          ],
          aiHelp: "Di 'crea una tarea de [tema] para [curso] con [N] preguntas' y yo la genero",
        },
        grade_submissions: {
          titulo: "Calificar Entregas",
          url: "/teacher/assignments",
          pasos: [
            "Ve a Teacher > Tareas",
            "Click en la tarea que quieres calificar",
            "Veras lista de estudiantes con estado (Pendiente/Entregado/Calificado)",
            "Click en el icono de calificar (estrella o lapiz) de cada estudiante",
            "Ingresa nota (0-10) y comentario opcional",
            "Guardar nota",
          ],
          consejos: [
            "Usa 'Marcar como no entregados' para poner ausentes a quienes no entregan",
            "Puedes calificar todos en lote diciendo 'califica con 7 los pendientes'",
          ],
          aiHelp: "Di 'califica con [nota] los pendientes de [tarea]' y yo lo hago",
        },
        import_students: {
          titulo: "Importar Estudiantes por CSV",
          url: "/admin/usuarios",
          pasos: [
            "Ve a Admin > Usuarios",
            "Selecciona pestana 'Estudiantes'",
            "Click 'Importar CSV'",
            "Prepara archivo con formato: Cedula;Nombre;Email (sin headers)",
            "Ejemplo: 1234567890;Juan Perez;juan@email.com",
            "Selecciona el archivo y espera preview",
            "Confirma para importar",
          ],
          consejos: [
            "El archivo debe ser .csv con separador punto y coma (;)",
            "Si la cedula ya existe, el estudiante se reactiva",
            "No incluyas fila de headers",
          ],
          aiHelp: "Adjunta el archivo CSV y di 'importa estos estudiantes'",
        },
        create_course: {
          titulo: "Crear Nuevo Curso",
          url: "/admin/cursos",
          pasos: [
            "Ve a Admin > Cursos",
            "Click 'Nuevo Curso'",
            "Ingresa nombre y nivel (ej: 3ro BGU)",
            "Asigna profesor tutor (opcional)",
            "Agrega pares profesor-materia con el boton +",
            "Guardar curso",
          ],
          consejos: [
            "El tutor ve el curso en su dashboard principal",
            "Puedes agregar varios profesores al mismo curso",
            "Cada profesor puede tener materias diferentes",
          ],
          aiHelp: "Di 'crea el curso [nombre] para [nivel]' y yo lo creo",
        },
        send_credentials: {
          titulo: "Enviar Credenciales por Email",
          url: "/admin/cursos/[id]",
          pasos: [
            "Ve a Admin > Cursos",
            "Click en el curso especifico",
            "Click 'Enviar Credenciales'",
            "Opcional: marca 'Regenerar PINs' si quieres nuevos",
            "Confirma el envio",
          ],
          consejos: [
            "Los estudiantes deben tener email registrado",
            "Si el email falla, el estudiante no recibe nada",
            "Puedes regenerar PINs para todos si olvidaron",
          ],
          aiHelp: "Di 'envia credenciales al curso [nombre]' desde la pagina del curso",
        },
        schedule: {
          titulo: "Configurar Horario de Curso",
          url: "/admin/cursos/[id]",
          pasos: [
            "Ve a Admin > Cursos > [curso] > Pestana Horario",
            "Define bloques de tiempo (hora inicio y fin)",
            "Para cada dia, selecciona materia o 'Receso'",
            "Los bloques vacios significan sin clase",
            "Guardar horario",
          ],
          consejos: [
            "Usa 'Receso' para descansos",
            "Puedes tener maximo 8 bloques por dia",
            "El horario se muestra a estudiantes en /student/horario",
          ],
          aiHelp: "Usa la edicion manual desde la pagina del curso",
        },
        report_cards: {
          titulo: "Generar Boletin de Notas",
          url: "/admin/boletin/[cursoId]",
          pasos: [
            "Ve a Admin > Cursos",
            "Click en 'Ver Boletin' del curso",
            "Veras tabla con estudiantes y sus notas por materia",
            "El promedio anual se calcula: (T1+T2+T3)/3",
            "Usa el boton 'Imprimir' para PDF",
          ],
          consejos: [
            "Azul = Aprobado (>=7), Rojo = Reprobado (<7)",
            "Trimestres sin nota cuentan como 0",
            "Los campos de firma son para imprimiry firmar manualmente",
          ],
          aiHelp: "Ve directamente a Admin > Cursos > [curso] > Boletin",
        },
        smtp_config: {
          titulo: "Configurar Email (SMTP)",
          url: "/admin/configuracion",
          pasos: [
            "Ve a Admin > Configuracion",
            "Selecciona proveedor: Gmail, Outlook o Custom",
            "Para Gmail: necesitas contrasena de aplicacion de 16 digitos",
            "Para crear contrasena: Mi Cuenta > Seguridad > Contrasenas de aplicacion",
            "Ingresa host, puerto, usuario y contrasena",
            "Click 'Probar Conexion'",
          ],
          consejos: [
            "Gmail puerto: 587, SSL: no",
            "Outlook puerto: 587, SSL: no",
            "Si falla, verifica que la contrasena de aplicacion sea correcta",
          ],
          aiHelp: "Solo configuracion manual desde esta pagina",
        },
        analytics: {
          titulo: "Ver Estadisticas de Practica con IA",
          url: "/teacher/analytics",
          pasos: [
            "Ve a Teacher > Analiticas",
            "Filtra por curso si tienes varios",
            "Veras: sesiones totales, precision %, XP promedio",
            "Abajo: temas con mas errores y rendimiento por estudiante",
          ],
          consejos: [
            "Las estadisticas son de practica voluntaria con IA",
            "No incluyen tareas oficiales (son en /teacher/grades)",
            "Los estudiantes ven su progreso en /student/practice",
          ],
          aiHelp: "Ve directamente a Teacher > Analiticas para ver los datos",
        },
        student_risk: {
          titulo: "Ver Estudiantes en Riesgo",
          url: "/teacher/dashboard",
          pasos: [
            "Ve a Teacher > Dashboard",
            "Busca el semaforo amarillo/rojo en cada estudiante",
            "Amarillo: 3+ fallos consecutivos o 7+ dias inactivo",
            "Rojo: ambos indicadores activos",
          ],
          consejos: [
            "El semaforo se basa en practica con IA, no en tareas",
            "Un estudiante inactivo 7+ dias necesita atencion",
            "Fallos consecutivos indican que necesita reforzar tema",
          ],
          aiHelp: "Di 'muestra los estudiantes en riesgo' y yo te los listo",
        },
      };

      const guide = guides[feature];
      if (!guide) {
        return { error: "Guia no disponible para esta caracteristica" };
      }

      return {
        ...guide,
        aiHelp: guide.aiHelp,
      };
    },
  });

  const getAIFeatures = tool({
    description: "Lista todas las funciones que la IA puede realizar para el rol del usuario. Usala cuando pregunten 'que puedes hacer' o 'como me ayudas'.",
    inputSchema: z.object({}),
    execute: async () => {
      return {
        text: `¡Hola! Soy Atlas IA, tu asistente en Atlas Edu.

Puedo ayudarte de muchas formas:

📚 TAREAS Y CALIFICACIONES
   "crea una tarea de ecuaciones para 3ro BGU"
   "califica con 7 todos los pendientes de la tarea de fracciones"
   "qué tareas tienen entregas sin calificar?"

📖 CUESTIONARIOS DE ESTUDIO (NUEVO)
   "crea un cuestionario de estudio sobre ecuaciones para 3ro BGU"
   "genera una guía de estudio para el examen de química"
   Los estudiantes pueden verlo y descargarlo como PDF

👥 GESTIÓN DE ESTUDIANTES
   "busca al estudiante Juan Pérez"
   "muestra los estudiantes en riesgo académico"
   "envía un recordatorio a los de 3ro BGU"

📊 INFORMES Y DATOS
   "cuál es el promedio de la clase de matemáticas?"
   "cuántos estudiantes tengo en total?"
   "cómo están los estudiantes esta semana?"

🔧 ACCIONES RÁPIDAS
   "registra presentes a los de hoy"
   "marca ausentes a los que no entregaron"
   "genera un examen de química para 3ro BGU"

💬 CONVERSACIÓN
   También puedo conversar contigo sobre cualquier tema: matemáticas, ciencia, historia, o simplemente ayudarte a pensar algo.

Solo dime qué necesitas y lo hacemos juntos. 😊`
      };
    },
  });

  // ─── Acción ───

  const generateAndCreateAssignment = tool({
    description: "Genera una tarea con IA y la publica automaticamente en la plataforma. Usala cuando el docente pida crear una tarea nueva. Primero usa getMyCourses y searchSubject para obtener los IDs. Si el usuario no especifica curso, materia, tema, numero de preguntas o fecha de entrega, preguntale. Si el usuario proporciona contenido en un archivo adjunto, basa las preguntas estrictamente en ese contenido.",
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
      logAiCall({ route: "ai-tool/generate-assignment", model: DEFAULT_MODEL_ID, durationMs: Date.now() - start, usage: aiResult.usage ? { inputTokens: aiResult.usage.inputTokens, outputTokens: aiResult.usage.outputTokens, totalTokens: (aiResult.usage.inputTokens ?? 0) + (aiResult.usage.outputTokens ?? 0) } : undefined });

      let text = aiResult.text || "";
      let data = tryParseJson(text);
      data = normalizeAssignmentKeys(data);

      if (!data || typeof data !== "object") {
        data = { title: topic, description: `Tarea sobre ${topic}`, questions: [] };
      }

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

      const rawQuestions = (data.questions || []).slice(0, 15);
      const questions = [];
      for (let i = 0; i < rawQuestions.length; i++) {
        const q = normalizeQuestionItem(rawQuestions[i]);
        if (!q || !q.question) continue;
        await db.insert(assignmentQuestions).values({
          assignmentId: assignment.id,
          type: q.type === "file_upload" ? "file_upload" : "mcq",
          question: q.question || "",
          options: q.type === "file_upload" ? undefined : (q.options || []),
          correctIndex: q.type === "file_upload" ? undefined : (q.correctIndex ?? 0),
          points: q.points || 1,
          orderIndex: i,
        } as any);
        questions.push(q);
      }

      return {
        creada: true,
        tarea_id: assignment.id,
        titulo: data.title || assignment.title,
        preguntas: questions.length,
        mensaje: `Tarea "${data.title || assignment.title}" creada exitosamente con ${questions.length} preguntas para ${subjectName}.`,
      };
    },
  });

  const generateCuestionarioEstudio = tool({
    description: "Genera un cuestionario de estudio con IA basado en el material subido por el docente (studyMaterials). El cuestionario incluye preguntas con respuestas correctas y explicaciones para que los estudiantes estudien. Se guarda en la plataforma y los estudiantes pueden verlo y descargarlo como PDF. Usala cuando el docente pida 'crea un cuestionario de estudio', 'genera una guia de estudio', o 'prepara un cuestionario para el examen'. Primero usa getMyCourses y searchSubject si necesitas IDs.",
    inputSchema: z.object({
      cursoId: z.number().describe("ID del curso al que pertenece el cuestionario"),
      subjectId: z.number().describe("ID de la materia"),
      topic: z.string().describe("Tema del cuestionario, ej: 'Ecuaciones de primer grado', 'Simple Past', 'La celula'"),
      questionCount: z.number().optional().default(10).describe("Cantidad de preguntas (5-20)"),
      useStudyMaterial: z.boolean().optional().default(true).describe("Si es true, busca el material de estudio subido para esa materia/curso y lo usa como contexto"),
    }),
    execute: async ({ cursoId, subjectId, topic, questionCount, useStudyMaterial }) => {
      const subjectData = await db.select({ name: subjects.name, slug: subjects.slug, emoji: subjects.emoji }).from(subjects).where(eq(subjects.id, subjectId)).limit(1);
      const subjectName = subjectData[0]?.name || "materia";
      const subjectEmoji = subjectData[0]?.emoji || "📚";

      const courseData = await db.select({ nombre: cursos.nombre, nivel: cursos.nivel }).from(cursos).where(eq(cursos.id, cursoId)).limit(1);
      const courseName = courseData[0]?.nombre || "";

      const count = Math.min(Math.max(5, questionCount || 10), 20);

      let studyContent = "";
      let materialTruncated = false;
      if (useStudyMaterial) {
        const material = await db
          .select({ title: studyMaterials.title, content: studyMaterials.content })
          .from(studyMaterials)
          .where(and(eq(studyMaterials.cursoId, cursoId), eq(studyMaterials.subjectId, subjectId)))
          .limit(1);
        if (material.length > 0) {
          const rawContent = material[0].content;
          if (rawContent.length > 5000) {
            studyContent = `\n\nMATERIAL DE ESTUDIO DEL DOCENTE:\nTitulo: ${material[0].title}\nContenido (primeros 5000 caracteres):\n${rawContent.slice(0, 5000)}\n\n[... El material original tiene ${rawContent.length} caracteres. Se usaron los primeros 5000 para la generacion.]`;
            materialTruncated = true;
          } else {
            studyContent = `\n\nMATERIAL DE ESTUDIO DEL DOCENTE:\nTitulo: ${material[0].title}\nContenido:\n${rawContent}`;
          }
        }
      }

      const aiPrompt = `Eres un docente experto en educacion secundaria acelerada de adultos (PCEI Ecuador). Genera un cuestionario de estudio en formato JSON.

Materia: ${subjectName}
Curso: ${courseName}
Tema: ${topic}
Cantidad de preguntas: ${count}${studyContent}

REGLAS IMPORTANTES:
1. Este cuestionario es para que los ESTUDIANTES ESTUDIEN, no es un examen. Debe incluir las respuestas correctas y explicaciones.
2. MEZCLA los tipos de pregunta: usa "mcq" (opcion multiple con 4 opciones) y "completar" (completar el espacio en blanco con 4 opciones).
3. Para type "completar": la pregunta debe contener "___" donde va el espacio en blanco. Las 4 opciones son posibles respuestas para llenar el blanco.
4. Incluye "correctIndex" (0-3) indicando cual es la respuesta correcta.
5. Incluye "explanation" (texto breve en español) explicando POR QUE esa es la respuesta correcta, para que el estudiante aprenda.
6. Las preguntas deben ser claras, didacticas y cubrir los conceptos clave del tema.
7. Si hay material de estudio, basa las preguntas ESTRICTAMENTE en ese contenido.
8. Lenguaje claro y accesible para adultos.
9. IMPORTANTISIMO: SOLO responde con JSON puro. Empieza con { y termina con }. Sin markdown.

FORMATO JSON:
{
  "title": "Cuestionario de estudio: [tema]",
  "description": "Descripcion del cuestionario con instrucciones para el estudiante (min 2 parrafos).",
  "questions": [
    {
      "type": "mcq",
      "question": "Pregunta clara sobre el tema?",
      "options": ["Opcion A", "Opcion B", "Opcion C", "Opcion D"],
      "correctIndex": 0,
      "explanation": "Explicacion breve de por que esta es la respuesta correcta.",
      "points": 1
    },
    {
      "type": "completar",
      "question": "La capital de Francia es ___",
      "options": ["Paris", "Londres", "Berlin", "Madrid"],
      "correctIndex": 0,
      "explanation": "Paris es la capital de Francia.",
      "points": 1
    }
  ]
}`;

      const start = Date.now();
      const aiResult = await generateText({ model: opencodeGoModel, prompt: aiPrompt, temperature: 0.4, maxOutputTokens: 8000 });
      logAiCall({ route: "ai-tool/generate-cuestionario", model: DEFAULT_MODEL_ID, durationMs: Date.now() - start, usage: aiResult.usage ? { inputTokens: aiResult.usage.inputTokens, outputTokens: aiResult.usage.outputTokens, totalTokens: (aiResult.usage.inputTokens ?? 0) + (aiResult.usage.outputTokens ?? 0) } : undefined });

      let text = aiResult.text || "";
      let data = tryParseJson(text);
      data = normalizeAssignmentKeys(data);

      if (!data || typeof data !== "object" || !data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
        const rawPreview = (text || "").slice(0, 300);
        return {
          error: "La IA no pudo generar las preguntas del cuestionario. Intenta con un tema mas especifico o menos contenido.",
          detalle: `Respuesta de la IA: ${rawPreview}${materialTruncated ? "\n\nNota: El material de estudio fue truncado porque era muy extenso (mas de 5000 caracteres)." : ""}`,
        };
      }

      const [cuestionario] = await db.insert(cuestionarios).values({
        teacherId: userId,
        subjectId,
        cursoId,
        title: data.title?.slice(0, 200) || `Cuestionario: ${topic}`,
        description: data.description || `Cuestionario de estudio sobre ${topic}`,
        trimester: 1,
      } as any).returning();

      const rawQuestions = (data.questions || []).slice(0, 30);
      const questions = [];
      for (let i = 0; i < rawQuestions.length; i++) {
        const q = normalizeQuestionItem(rawQuestions[i]);
        if (!q || !q.question) continue;
        const qType = q.type === "completar" ? "completar" : "mcq";
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
        questions.push(q);
      }

      if (cursoId) {
        await notifyStudentsInCourse({
          cursoId,
          type: "study_material",
          title: `Nuevo cuestionario de estudio: ${data.title || cuestionario.title}`,
          message: `Se ha publicado un cuestionario de "${subjectName}" con ${questions.length} preguntas para que estudies. Puedes verlo y descargarlo como PDF en tu menú "Estudio".`,
          excludeUserId: userId,
          link: `/student/cuestionarios/${cuestionario.id}`,
        }).catch(() => {});
      }

      return {
        creado: true,
        cuestionario_id: cuestionario.id,
        titulo: data.title || cuestionario.title,
        materia: subjectName,
        preguntas: questions.length,
        material_truncado: materialTruncated,
        mensaje: `Cuestionario de estudio "${data.title || cuestionario.title}" creado exitosamente con ${questions.length} preguntas para ${subjectName}. Puedes verlo en Teacher > Cuestionarios.${materialTruncated ? "\n\nNota: El material de estudio era muy extenso y se truncó a 5000 caracteres. Si falta contenido, considera dividir el tema en varios cuestionarios mas pequeños." : ""}`,
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

      await notifyStudentsInCourse({
        cursoId,
        type: "message",
        title: `Nuevo mensaje de ${userFullName || "tu profesor"}`,
        message: message.slice(0, 120),
        excludeUserId: userId,
      });

      const cursoData = await db.select({ nombre: cursos.nombre }).from(cursos).where(eq(cursos.id, cursoId)).limit(1);
      return {
        enviados: sent,
        estudiantes: students.map(s => s.fullName),
        curso: cursoData[0]?.nombre || "",
        mensaje: `Mensaje enviado a ${sent} estudiantes de ${cursoData[0]?.nombre || "el curso"}.`,
      };
    },
  });

  const sendMessageToStudent = tool({
    description: "Envia un mensaje directo a un estudiante especifico. Usala cuando el docente pida enviar un mensaje a un estudiante en particular (no a todo el curso).",
    inputSchema: z.object({
      studentId: z.number().describe("ID del estudiante que recibira el mensaje"),
      message: z.string().min(1).describe("Contenido del mensaje a enviar"),
    }),
    execute: async ({ studentId, message }) => {
      const [student] = await db
        .select({ id: users.id, fullName: users.fullName })
        .from(users)
        .where(and(eq(users.id, studentId), eq(users.activo, true)))
        .limit(1);

      if (!student) return { error: "Estudiante no encontrado o inactivo" };

      await db.insert(directMessages).values({
        senderId: userId,
        receiverId: student.id,
        content: message,
      } as any);

      await notifyUser({
        userId: student.id,
        type: "message",
        title: `Nuevo mensaje de ${userFullName || "tu profesor"}`,
        message: message.slice(0, 120),
      });

      return {
        enviado: true,
        estudiante: student.fullName,
        mensaje: `Mensaje enviado a ${student.fullName}.`,
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

  const batchGradeSubmissions = tool({
    description: "Califica en lote submissions de estudiantes para una tarea. Permite nota unica para todos o notas individuales. Filtra por curso si el docente tiene varios.",
    inputSchema: z.object({
      assignmentId: z.number().describe("ID de la tarea"),
      cursoId: z.number().optional().describe("Filtrar por curso especifico"),
      defaultGrade: z.number().optional().describe("Nota default si todos reciben la misma"),
      studentGrades: z.array(z.object({
        fullName: z.string().describe("Nombre o apellido del estudiante"),
        grade: z.number().describe("Nota para este estudiante"),
      })).optional().describe("Notas individuales en vez de default"),
      feedback: z.string().optional().describe("Comentario de retroalimentacion para todos"),
    }),
    execute: async ({ assignmentId, cursoId, defaultGrade, studentGrades, feedback }) => {
      const [assignment] = await db
        .select({ id: assignments.id, title: assignments.title, puntos: assignments.puntos, teacherId: assignments.teacherId, cursoId: assignments.cursoId })
        .from(assignments)
        .where(eq(assignments.id, assignmentId))
        .limit(1);

      if (!assignment) {
        return { error: "Tarea no encontrada" };
      }

      if (assignment.teacherId !== userId) {
        return { error: "No tienes acceso a esta tarea" };
      }

      if (cursoId) {
        const courseAccess = await db
          .select({ id: cursoProfesores.id })
          .from(cursoProfesores)
          .where(and(eq(cursoProfesores.cursoId, cursoId), eq(cursoProfesores.teacherId, userId)))
          .limit(1);
        const isTutor = await db.select({ id: cursos.id }).from(cursos).where(and(eq(cursos.id, cursoId), eq(cursos.profesorId, userId))).limit(1);
        if (!courseAccess.length && !isTutor.length) {
          return { error: "No tienes acceso a este curso" };
        }
      }

      const targetCursoId = cursoId || assignment.cursoId;
      if (!targetCursoId) {
        return { error: "La tarea no tiene un curso asociado. Especifica cursoId." };
      }

      const enrolledStudents = await db
        .select({ id: users.id, fullName: users.fullName })
        .from(cursoEstudiantes)
        .innerJoin(users, eq(users.id, cursoEstudiantes.estudianteId))
        .where(and(eq(cursoEstudiantes.cursoId, targetCursoId), eq(users.activo, true)));

      if (enrolledStudents.length === 0) {
        return { error: "No hay estudiantes enrolled en este curso" };
      }

      const existingSubmissions = await db
        .select({ id: assignmentSubmissions.id, studentId: assignmentSubmissions.studentId, status: assignmentSubmissions.status })
        .from(assignmentSubmissions)
        .where(eq(assignmentSubmissions.assignmentId, assignmentId));

      const hasStudentGrades = studentGrades && studentGrades.length > 0;
      const gradeMap: Record<string, number> = {};
      if (hasStudentGrades) {
        for (const sg of studentGrades) {
          const match = enrolledStudents.find(s =>
            s.fullName.toLowerCase().includes(sg.fullName.toLowerCase())
          );
          if (match) {
            gradeMap[match.id] = sg.grade;
          }
        }
      }

      const results: any[] = [];
      let updatedCount = 0;
      let createdCount = 0;

      for (const student of enrolledStudents) {
        const targetGrade = hasStudentGrades
          ? gradeMap[student.id]
          : defaultGrade;

        if (!targetGrade && !hasStudentGrades) {
          continue;
        }

        const existing = existingSubmissions.find(s => s.studentId === student.id);

        if (existing) {
          await db.update(assignmentSubmissions)
            .set({
              grade: targetGrade,
              feedback: feedback || null,
              status: "graded",
              submittedAt: new Date(),
            } as any)
            .where(eq(assignmentSubmissions.id, existing.id));
          updatedCount++;
          results.push({ name: student.fullName, action: "actualizado", grade: targetGrade });
        } else {
          await db.insert(assignmentSubmissions).values({
            assignmentId,
            studentId: student.id,
            grade: targetGrade,
            feedback: feedback || null,
            status: "graded",
            submittedAt: new Date(),
          } as any);
          createdCount++;
          results.push({ name: student.fullName, action: "creado", grade: targetGrade });
        }
      }

      const mensaje = `Se calificarion ${updatedCount + createdCount} estudiantes para "${assignment.title}": ${updatedCount} actualizados, ${createdCount} creados.`;

      return {
        success: true,
        tarea: assignment.title,
        puntosMaximos: assignment.puntos,
        totalProcesados: results.length,
        actualizados: updatedCount,
        creados: createdCount,
        detalles: results,
        mensaje,
      };
    },
  });

  return {
    getMyCourses,
    searchSubject,
    getCourseStudents,
    getStudentRisk,
    getAttendanceToday,
    getRecentAssignments,
    getPracticeAnalytics,
    searchAssignments,
    searchStudents,
    getPendingGrades,
    generateAndCreateAssignment,
    generateCuestionarioEstudio,
    sendMessageToStudents,
    sendMessageToStudent,
    markStudentsAbsent,
    checkAcademicLoad,
    recordPhysicalGrades,
    batchGradeSubmissions,
    getFeatureGuide,
    getAIFeatures,
  };
}

// ═══════════════════ ADMIN TOOLS ═══════════════════

function createAdminTools(userId: number, userFullName: string = "") {

  // ─── Consulta ───

  const getPlatformStats = tool({
    description: "Obtiene estadisticas generales: estudiantes, docentes, cursos",
    inputSchema: z.object({}),
    execute: async () => {
      const [s, t, c] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(users).where(and(eq(users.role, "student"), eq(users.activo, true))),
        db.select({ count: sql<number>`count(*)` }).from(users).where(and(eq(users.role, "teacher"), eq(users.activo, true))),
        db.select({ count: sql<number>`count(*)` }).from(cursos).where(eq(cursos.activo, true)),
      ]);
      return { estudiantes: s[0]?.count || 0, docentes: t[0]?.count || 0, cursos: c[0]?.count || 0 };
    },
  });

  const getUsersByRole = tool({
    description: "Lista todos los usuarios de un rol especifico",
    inputSchema: z.object({
      role: z.enum(["student", "teacher", "admin"]).describe("Rol a filtrar"),
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
      const courseIds = courses.map(c => c.id);
      const counts = courseIds.length > 0
        ? await db.select({ cursoId: cursoEstudiantes.cursoId, count: sql<number>`count(*)::int` }).from(cursoEstudiantes).where(inArray(cursoEstudiantes.cursoId, courseIds)).groupBy(cursoEstudiantes.cursoId)
        : [];
      const countMap = new Map(counts.map(c => [c.cursoId, c.count]));
      const result = courses.map(c => ({ ...c, estudiantes: countMap.get(c.id) ?? 0 }));
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
      const cedulas = students.map(s => s.cedula);
      const existingUsers = cedulas.length > 0
        ? await db.select({ id: users.id, cedula: users.cedula, activo: users.activo }).from(users).where(inArray(users.cedula, cedulas))
        : [];
      const existingMap = new Map(existingUsers.map(u => [u.cedula, u]));

      const pins = students.map(() => generatePin());
      const hashedPins = await Promise.all(pins.map(p => bcrypt.hash(p, 10)));

      const toInsert: any[] = [];
      const toReactivate: { id: number; fullName: string; email: string | null; pin: string }[] = [];
      const errors: any[] = [];

      for (let i = 0; i < students.length; i++) {
        const s = students[i];
        const existing = existingMap.get(s.cedula);
        const pin = pins[i];
        const hashed = hashedPins[i];

        if (existing) {
          if (!existing.activo) {
            toReactivate.push({ id: existing.id, fullName: s.fullName, email: s.email || null, pin: hashed });
            results.push({ cedula: s.cedula, fullName: s.fullName, pin, reactivado: true });
          } else {
            results.push({ cedula: s.cedula, fullName: s.fullName, error: "Ya existe" });
          }
        } else {
          toInsert.push({ cedula: s.cedula, fullName: s.fullName, role: "student", email: s.email || null, pin: hashed });
          results.push({ cedula: s.cedula, fullName: s.fullName, pin, creado: true });
        }
      }

      if (toInsert.length > 0) await db.insert(users).values(toInsert);
      await Promise.all(toReactivate.map(r =>
        db.update(users).set({ activo: true, fullName: r.fullName, email: r.email, pin: r.pin }).where(eq(users.id, r.id))
      ));

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
        const pins = withEmail.map(() => generatePin());
        const hashedPins = await Promise.all(pins.map(p => bcrypt.hash(p, 10)));
        await Promise.all(withEmail.map((s, i) =>
          db.update(users).set({ pin: hashedPins[i] }).where(eq(users.id, s.id))
        ));
        withEmail.forEach((s, i) => { pinsByStudent[s.id] = pins[i]; });
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
      logAiCall({ route: "ai-tool/generate-exam-template", model: DEFAULT_MODEL_ID, durationMs: Date.now() - start, usage: aiResult.usage ? { inputTokens: aiResult.usage.inputTokens, outputTokens: aiResult.usage.outputTokens, totalTokens: (aiResult.usage.inputTokens ?? 0) + (aiResult.usage.outputTokens ?? 0) } : undefined });

      let text = aiResult.text || "";
      let data: any;
      try {
        data = tryParseJson(text);
        data = normalizeAssignmentKeys(data);
      } catch {
        return { error: "La IA no pudo generar el examen en formato válido. Intenta nuevamente o ajusta los parámetros." };
      }

      if (!data || typeof data !== "object") {
        return { error: "La IA no pudo generar el examen en formato válido. Intenta nuevamente o ajusta los parámetros." };
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

        const rawQuestions = (data.questions || []).slice(0, 20);
        const questions = [];
        for (let i = 0; i < rawQuestions.length; i++) {
          const q = normalizeQuestionItem(rawQuestions[i]);
          if (!q || !q.question) continue;
          await db.insert(assignmentQuestions).values({
            assignmentId: assignment.id,
            type: q.type === "file_upload" ? "file_upload" : "mcq",
            question: q.question || "",
            options: q.type === "file_upload" ? undefined : (q.options || []),
            correctIndex: q.type === "file_upload" ? undefined : (q.correctIndex ?? 0),
            points: q.points || 1,
            orderIndex: i,
          } as any);
          questions.push(q);
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
        mensaje: `Plantilla de examen "${data.title || "Examen"}" creada y guardada como borrador para ${createdAssignments.length} paralelos del nivel "${nivel}".`,
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
        mensaje: `Se registradas calificaciones para ${successCount} estudiantes en la actividad "${activityTitle}" del curso ${course.nombre}.`,
      };
    },
  });

  const getFeatureGuide = tool({
    description: "Obtiene guia paso a paso de una funcionalidad de la plataforma para administradores. Retorna URL de la pagina, pasos a seguir, y consejos.",
    inputSchema: z.object({
      feature: z.enum([
        "import_students",
        "create_course",
        "manage_enrollments",
        "send_credentials",
        "schedule",
        "report_cards",
        "smtp_config",
        "manage_periods",
        "manage_users",
        "student_risk",
        "attendance",
        "grades",
      ]).describe("Caracteristica de la plataforma"),
    }),
    execute: async ({ feature }) => {
      const guides: Record<string, any> = {
        import_students: {
          titulo: "Importar Estudiantes por CSV",
          url: "/admin/usuarios",
          pasos: [
            "Ve a Admin > Usuarios",
            "Selecciona pestana 'Estudiantes'",
            "Click 'Importar CSV'",
            "Prepara archivo con formato: Cedula;Nombre;Email (sin headers)",
            "Ejemplo: 1234567890;Juan Perez;juan@email.com",
            "Selecciona el archivo y espera preview",
            "Confirma para importar",
          ],
          consejos: [
            "El archivo debe ser .csv con separador punto y coma (;)",
            "Si la cedula ya existe, el estudiante se reactiva",
            "Para crear estudiantes manualmente: pestana Estudiantes > 'Nuevo Estudiante'",
          ],
          aiHelp: "Adjunta el archivo CSV y di 'importa estos estudiantes'",
        },
        create_course: {
          titulo: "Crear Nuevo Curso",
          url: "/admin/cursos",
          pasos: [
            "Ve a Admin > Cursos",
            "Click 'Nuevo Curso'",
            "Ingresa nombre y nivel (ej: 3ro BGU)",
            "Asigna profesor tutor (opcional)",
            "Agrega pares profesor-materia con el boton +",
            "Guardar curso",
          ],
          consejos: [
            "El tutor ve el curso en su dashboard principal",
            "Puedes agregar varios profesores al mismo curso",
            "Cada profesor puede tener materias diferentes",
            "El nivel es importantisimo: 1ro, 2do, 3ro BGU",
          ],
          aiHelp: "Di 'crea el curso [nombre] para [nivel]' y yo lo creo",
        },
        manage_enrollments: {
          titulo: "Gestionar Inscripciones de Curso",
          url: "/admin/cursos/[id]",
          pasos: [
            "Ve a Admin > Cursos",
            "Click en el curso especifico",
            "Veras la pestana 'Estudiantes Inscritos'",
            "Para agregar: usa el buscador y click 'Agregar'",
            "Para quitar: click 'Quitar' al lado del estudiante",
            "Los cambios se guardan automaticamente",
          ],
          consejos: [
            "Solo estudiantes activos aparecen en el buscador",
            "Un estudiante puede estar en varios cursos",
            "Quitar un estudiante NO elimina sus notas",
          ],
          aiHelp: "Di 'inscribe al estudiante Juan al curso Matematicas' o 'quitalo del curso'",
        },
        send_credentials: {
          titulo: "Enviar Credenciales por Email",
          url: "/admin/cursos/[id]",
          pasos: [
            "Ve a Admin > Cursos",
            "Click en el curso especifico",
            "Ve a pestana 'Credenciales' o click 'Enviar Credenciales'",
            "Opcional: marca 'Regenerar PINs' si quieres nuevos",
            "Confirma el envio",
          ],
          consejos: [
            "Los estudiantes deben tener email registrado",
            "El email incluye cedula como usuario y PIN",
            "Si el email falla, el estudiante no recibe nada",
            "Puedes ver quienes ya recibieron email en el historial",
          ],
          aiHelp: "Primero asegurate que los estudiantes tienen email en Admin > Usuarios",
        },
        schedule: {
          titulo: "Configurar Horario de Curso",
          url: "/admin/cursos/[id]",
          pasos: [
            "Ve a Admin > Cursos > [curso] > pestana Horario",
            "Define bloques de tiempo (hora inicio y fin)",
            "Para cada dia, selecciona materia o 'Receso'",
            "Los bloques vacios significan sin clase",
            "Guardar horario",
          ],
          consejos: [
            "Usa 'Receso' para descansos",
            "Puedes tener maximo 8 bloques por dia",
            "El horario se muestra a estudiantes en /student/horario",
            "El horario se muestra a docentes en /teacher/horario",
          ],
          aiHelp: "Configuracion manual desde la pagina del curso",
        },
        report_cards: {
          titulo: "Generar e Imprimir Boletin de Notas",
          url: "/admin/boletin/[id]",
          pasos: [
            "Ve a Admin > Cursos",
            "Click en 'Ver Boletin' del curso",
            "Veras tabla con estudiantes y sus notas por materia",
            "El promedio anual se calcula: (T1+T2+T3)/3",
            "Usa el boton 'Imprimir' para generar PDF",
          ],
          consejos: [
            "Azul = Aprobado (>=7), Rojo = Reprobado (<7)",
            "Trimestres sin nota cuentan como 0",
            "Los campos de firma son para imprimir y firmar manualmente",
            "Solo aparecen cursos con estudiantes inscritos",
          ],
          aiHelp: "Ve directamente a Admin > Cursos > [curso] > Boletin",
        },
        smtp_config: {
          titulo: "Configurar Servidor de Email (SMTP)",
          url: "/admin/configuracion",
          pasos: [
            "Ve a Admin > Configuracion",
            "Selecciona proveedor: Gmail, Outlook o Personalizado",
            "Para Gmail: necesitas contrasena de aplicacion de 16 digitos",
            "Para crear contrasena: Cuenta Google > Seguridad > Contrasenas de aplicacion",
            "Ingresa host, puerto, usuario y contrasena",
            "Click 'Probar Conexion' para verificar",
          ],
          consejos: [
            "Gmail: host=smtp.gmail.com, puerto=587, SSL=no",
            "Outlook: host=smtp.office365.com, puerto=587, SSL=no",
            "Si falla, verifica que la contrasena de aplicacion sea correcta",
            "Guarda la configuracion antes de probar",
          ],
          aiHelp: "Solo configuracion manual desde esta pagina",
        },
        manage_periods: {
          titulo: "Gestionar Periodos Lectivos",
          url: "/admin/periodos",
          pasos: [
            "Ve a Admin > Periodos",
            "Click 'Nuevo Periodo' para crear",
            "Ingresa nombre (ej: 'Ano Lectivo 2024-2025')",
            "Opcionalmente define fecha inicio y fin",
            "Para activar un periodo, click el icono de toggle",
          ],
          consejos: [
            "Solo un periodo puede estar activo a la vez",
            "Activar uno desactiva automaticamente el anterior",
            "No puedes eliminar un periodo si tiene tareas asociadas",
          ],
          aiHelp: "Ve directamente a Admin > Periodos para gestionar",
        },
        manage_users: {
          titulo: "Gestionar Usuarios",
          url: "/admin/usuarios",
          pasos: [
            "Ve a Admin > Usuarios",
            "2 pestanas: Estudiantes | Docentes",
            "Para crear: click 'Nuevo' + llenar cedula, nombre, email",
            "Para editar: click en el usuario",
            "Para desactivar: toggle 'Activo' (no elimina datos)",
          ],
          consejos: [
            "La cedula es el usuario para login (10 digitos)",
            "El PIN se genera automaticamente y se muestra al crear",
            "Si olvidas el PIN, puedes 'Restablecer' desde editar",
          ],
          aiHelp: "Di 'crea el estudiante Juan Perez con cedula 1234567890'",
        },
        student_risk: {
          titulo: "Ver Estudiantes en Riesgo",
          url: "/admin/dashboard",
          pasos: [
            "Ve a Admin > Dashboard",
            "Veras la lista de estudiantes en riesgo academico",
            "El semaforo muestra: amarillo (alerta) o rojo (critico)",
            "Click en un estudiante para ver detalles",
          ],
          consejos: [
            "Amarillo: 3+ fallos en practica o 7+ dias inactivo",
            "Rojo: ambos indicadores activos",
            "Esto se basa en practica con IA, no en tareas oficiales",
          ],
          aiHelp: "Ve directamente a Admin > Dashboard para ver el resumen",
        },
        attendance: {
          titulo: "Ver Asistencia de Cursos",
          url: "/admin/asistencia/[cursoId]",
          pasos: [
            "Ve a Admin > Cursos > [curso] > pestana Asistencia",
            "Selecciona una fecha con el selector",
            "Veras lista de estudiantes con su estado",
            "Los estados son: presente, ausente, tardanza, justificado",
          ],
          consejos: [
            "Solo puedes ver asistencia, no editarla (eso lo hace el docente)",
            "Puedes ver asistencia de cualquier curso donde estes asignado",
          ],
          aiHelp: "Ve a Admin > Cursos > [curso] para ver la asistencia",
        },
        grades: {
          titulo: "Ver Notas de Curso",
          url: "/admin/grades",
          pasos: [
            "Ve a Admin > Cursos > [curso] > pestana Notas",
            "Veras matriz de estudiantes x materias",
            "Cada celda muestra T1, T2, T3 y promedio anual",
          ],
          consejos: [
            "Azul = Aprobado (>=7), Rojo = Reprobado (<7)",
            "El promedio anual es (T1+T2+T3)/3",
          ],
          aiHelp: "Ve a Admin > Boletin para ver el boletin completo",
        },
      };

      const guide = guides[feature];
      if (!guide) {
        return { error: "Guia no disponible para esta caracteristica" };
      }

      return { ...guide };
    },
  });

  const getAIFeatures = tool({
    description: "Lista todas las funciones que la IA puede realizar para el rol admin. Usala cuando pregunten 'que puedes hacer' o 'como me ayudas'.",
    inputSchema: z.object({}),
    execute: async () => {
      return {
        text: `¡Hola! Soy Atlas IA, tu asistente como Administrador en Atlas Edu.

Puedo ayudarte con todo esto:

👥 GESTIÓN DE USUARIOS
   "crea el estudiante Juan Pérez con cédula 1234567890"
   "importa estudiantes desde el CSV adjunto"
   "busca al usuario con cédula..."

🏫 GESTIÓN DE CURSOS
   "crea el curso Matemáticas 3ro BGU"
   "inscribe a Juan al curso 3ro BGU"
   "muestra los cursos activos"

📧 CREDENCIALES Y COMUNICACIÓN
   "envía PINs nuevos al curso 3ro BGU"
   "regenera las contraseñas de los estudiantes"
   "envía un mensaje a todos los de un curso"

📊 ESTADÍSTICAS Y REPORTES
   "cuántos estudiantes hay en total?"
   "cuántos docentes tenemos?"
   "genera el boletín de 3ro BGU"

📝 CALIFICACIONES
   "califica con 7 todos los pendientes"
   "muestra las tareas con entregas sin calificar"

💬 CONVERSACIÓN
   También puedo conversar sobre cualquier tema, investigar conceptos, o simplemente ayudarte a pensar algo.

Solo dime qué necesitas. 😊`
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
    getFeatureGuide,
    getAIFeatures,
  };
}

// ═══════════════════ EXPORT ═══════════════════

export function getToolsForRole(role: string, userId: number, userFullName: string = "") {
  if (role === "admin") return createAdminTools(userId, userFullName);
  return createTeacherTools(userId, userFullName);
}
