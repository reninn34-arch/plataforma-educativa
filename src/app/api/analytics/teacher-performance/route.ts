import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { users, cursos, cursoEstudiantes, cursoProfesores, assignments, assignmentSubmissions, periodosLectivos } from "@/lib/db/schema";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { getTeacherCourseIds } from "@/lib/course-helpers";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const teacher = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!teacher || teacher.role !== "teacher") {
    return NextResponse.json({ error: "Solo docentes" }, { status: 403 });
  }

  const url = new URL(request.url);
  const filterCursoId = url.searchParams.get("cursoId") ? Number(url.searchParams.get("cursoId")) : null;
  const filterPeriodoId = url.searchParams.get("periodoId") ? Number(url.searchParams.get("periodoId")) : null;

  try {
    const [profileRow] = await db
      .select({ id: users.id, fullName: users.fullName, cedula: users.cedula, role: users.role, email: users.email })
      .from(users)
      .where(eq(users.id, teacher.id))
      .limit(1);

    const allIdsSet = await getTeacherCourseIds(teacher.id);
    if (allIdsSet.length === 0) {
      return NextResponse.json({
        profile: profileRow, students: [], periodComparison: [], stats: { enRiesgo: 0, promedioGeneral: 0, estudiantesConDatos: 0 }, activePeriod: null, periods: [],
      });
    }

    const ids = filterCursoId
      ? (allIdsSet.includes(filterCursoId) ? [filterCursoId] : [])
      : allIdsSet;

    if (ids.length === 0) {
      return NextResponse.json({
        profile: profileRow, students: [], periodComparison: [], stats: { enRiesgo: 0, promedioGeneral: 0, estudiantesConDatos: 0 }, activePeriod: null, periods: [],
      });
    }

    const [allPeriods, [activePeriod]] = await Promise.all([
      db.select().from(periodosLectivos).orderBy(desc(periodosLectivos.createdAt)),
      db.select().from(periodosLectivos).where(eq(periodosLectivos.activo, true)).limit(1),
    ]);

    const enrolled = await db
      .select({ estudianteId: cursoEstudiantes.estudianteId })
      .from(cursoEstudiantes)
      .where(inArray(cursoEstudiantes.cursoId, ids));

    const uniqueIds = [...new Set(enrolled.map(r => r.estudianteId))];

    if (uniqueIds.length === 0) {
      return NextResponse.json({
        profile: profileRow, students: [], periodComparison: [], stats: { enRiesgo: 0, promedioGeneral: 0, estudiantesConDatos: 0 }, activePeriod, periods: allPeriods,
      });
    }

    const periodoFilter = filterPeriodoId || activePeriod?.id || null;

    const allAssignments = await db
      .select({
        id: assignments.id,
        subjectId: assignments.subjectId,
        puntos: assignments.puntos,
        trimester: assignments.trimester,
        periodoLectivoId: assignments.periodoLectivoId,
        cursoId: assignments.cursoId,
      })
      .from(assignments)
      .where(and(
        eq(assignments.teacherId, teacher.id),
        inArray(assignments.cursoId, ids),
        ...(periodoFilter ? [eq(assignments.periodoLectivoId, periodoFilter)] : []),
      ));

    const assignmentIds = allAssignments.map(a => a.id);

    const submissions = assignmentIds.length > 0 ? await db
      .select({
        studentId: assignmentSubmissions.studentId,
        grade: assignmentSubmissions.grade,
        assignmentId: assignmentSubmissions.assignmentId,
      })
      .from(assignmentSubmissions)
      .where(and(
        inArray(assignmentSubmissions.assignmentId, assignmentIds),
        inArray(assignmentSubmissions.studentId, uniqueIds),
      )) : [];

    const studentNames = await db
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(inArray(users.id, uniqueIds));

    const nameMap = new Map(studentNames.map(u => [u.id, u.fullName]));

    const assignmentMap = new Map(allAssignments.map(a => [a.id, a]));

    const subByStudent = new Map<number, { grades: number[]; totalPts: number; submitted: number; total: number; pendientes: number }>();
    for (const id of uniqueIds) {
      subByStudent.set(id, { grades: [], totalPts: 0, submitted: 0, total: assignmentIds.length, pendientes: 0 });
    }

    const submittedSet = new Map<number, Set<number>>();
    for (const s of submissions) {
      if (!submittedSet.has(s.studentId)) submittedSet.set(s.studentId, new Set());
      submittedSet.get(s.studentId)!.add(s.assignmentId);
      const sd = subByStudent.get(s.studentId);
      if (!sd) continue;
      if (s.grade !== null && s.grade !== undefined) {
        const a = assignmentMap.get(s.assignmentId);
        const pts = a?.puntos || 10;
        sd.grades.push(s.grade);
        sd.totalPts += pts;
      }
    }

    for (const [sid, sd] of subByStudent) {
      sd.submitted = submittedSet.get(sid)?.size || 0;
      sd.pendientes = sd.total - sd.submitted;
    }

    let enRiesgo = 0;
    let sumaPromedios = 0;
    let estudiantesConDatos = 0;

    const byTrimester = new Map<number, { label: string; students: { name: string; promedio: number }[] }>();

    for (const s of allAssignments) {
      const t = s.trimester || 1;
      if (!byTrimester.has(t)) {
        byTrimester.set(t, { label: `Trimestre ${t}`, students: [] });
      }
    }

    const students = uniqueIds.map(id => {
      const sd = subByStudent.get(id)!;
      let promedio = 0;
      if (sd.grades.length > 0) {
        promedio = Math.round((sd.grades.reduce((a, b) => a + b, 0) / sd.grades.length) * 10) / 10;
        sumaPromedios += promedio;
        estudiantesConDatos++;
        if (promedio < 7) enRiesgo++;
      }
      const riesgo = promedio === 0 ? "medio" as const : promedio < 7 ? "alto" as const : promedio < 8.5 ? "medio" as const : "bajo" as const;
      return {
        id,
        fullName: nameMap.get(id) || `Usuario #${id}`,
        promedio,
        totalAssignments: sd.total,
        submittedAssignments: sd.submitted,
        pendientes: sd.pendientes,
        riesgo,
      };
    });

    for (const s of allAssignments) {
      const t = s.trimester || 1;
      const entry = byTrimester.get(t);
      if (!entry) continue;
      for (const id of uniqueIds) {
        const grade = submissions.find(su => su.studentId === id && su.assignmentId === s.id)?.grade;
        if (grade !== null && grade !== undefined) {
          const existing = entry.students.find(e => e.name === (nameMap.get(id) || `#${id}`));
          if (existing) {
            existing.promedio = (existing.promedio + grade) / 2;
          } else {
            entry.students.push({ name: nameMap.get(id) || `#${id}`, promedio: grade });
          }
        }
      }
    }

    const periodComparison = Array.from(byTrimester.entries()).map(([t, data]) => ({
      trimester: t,
      label: data.label,
      students: data.students.slice(0, 15),
    }));

    students.sort((a, b) => a.promedio - b.promedio);

    const promedioGeneral = estudiantesConDatos > 0
      ? Math.round((sumaPromedios / estudiantesConDatos) * 10) / 10
      : 0;

    return NextResponse.json({
      profile: profileRow,
      students,
      periodComparison,
      stats: { enRiesgo, promedioGeneral, estudiantesConDatos },
      activePeriod,
      periods: allPeriods,
    });
  } catch (error) {
    console.error("Teacher performance analytics error:", error);
    return NextResponse.json({ error: "Error al cargar analytics" }, { status: 500 });
  }
}
