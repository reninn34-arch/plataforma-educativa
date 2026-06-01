import { NextRequest, NextResponse } from "next/server";

/**
 * @swagger
 * /api/dashboard/admin:
 *   get:
 *     summary: Dashboard del administrador
 *     description: Devuelve resumen de cursos, estudiantes, profesores y actividad reciente.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Datos del dashboard del administrador
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No es administrador
 */
import { db } from "@/lib/db";
import { users, cursos, cursoEstudiantes, cursoProfesores, subjects } from "@/lib/db/schema";
import { eq, desc, sql, inArray } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Solo admin" }, { status: 403 });
  }

  try {
    const [
      [profileRow],
      rolesCount,
      [courseCount],
      allTeachers,
      allSubjects,
      data
    ] = await Promise.all([
      db.select({ id: users.id, fullName: users.fullName, cedula: users.cedula, role: users.role, email: users.email })
        .from(users).where(eq(users.id, user.id)).limit(1),
      db.select({ role: users.role, count: sql<number>`count(*)`.mapWith(Number) }).from(users).groupBy(users.role),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(cursos).where(eq(cursos.activo, true)),
      db.select({ id: users.id, fullName: users.fullName, cedula: users.cedula, email: users.email })
        .from(users).where(eq(users.role, "teacher")).orderBy(users.fullName),
      db.select().from(subjects).orderBy(subjects.name),
      db.select({
          id: cursos.id,
          nombre: cursos.nombre,
          nivel: cursos.nivel,
          profesorId: cursos.profesorId,
          profesorNombre: users.fullName,
          activo: cursos.activo,
          createdAt: cursos.createdAt,
          studentCount: sql<number>`count(DISTINCT ${cursoEstudiantes.estudianteId})`.mapWith(Number),
        })
        .from(cursos)
        .leftJoin(users, eq(cursos.profesorId, users.id))
        .leftJoin(cursoEstudiantes, eq(cursoEstudiantes.cursoId, cursos.id))
        .groupBy(cursos.id, users.fullName)
        .orderBy(desc(cursos.createdAt))
    ]);

    const roleMap = new Map(rolesCount.map(r => [r.role, r.count]));
    const stats = {
      totalEstudiantes: roleMap.get("student") || 0,
      totalProfesores: roleMap.get("teacher") || 0,
      totalPadres: roleMap.get("parent") || 0,
      totalCursos: courseCount?.count || 0,
    };

    const cursoIds = data.map(c => c.id);
    const allProfs = cursoIds.length > 0 ? await db
      .select({
        cursoId: cursoProfesores.cursoId,
        teacherId: cursoProfesores.teacherId,
        teacherName: users.fullName,
        subjectId: cursoProfesores.subjectId,
        subjectName: subjects.name,
        subjectEmoji: subjects.emoji,
      })
      .from(cursoProfesores)
      .innerJoin(users, eq(cursoProfesores.teacherId, users.id))
      .innerJoin(subjects, eq(cursoProfesores.subjectId, subjects.id))
      .where(inArray(cursoProfesores.cursoId, cursoIds)) : [];

    const profsByCurso = new Map<number, typeof allProfs>();
    for (const p of allProfs) {
      if (!profsByCurso.has(p.cursoId)) profsByCurso.set(p.cursoId, []);
      profsByCurso.get(p.cursoId)!.push(p);
    }

    const courses = data.map(c => ({ ...c, teacherSubjects: profsByCurso.get(c.id) || [] }));

    return NextResponse.json({ profile: profileRow, stats, courses, teachers: allTeachers, subjects: allSubjects });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    return NextResponse.json({ error: "Error al cargar dashboard" }, { status: 500 });
  }
}