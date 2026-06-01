import { NextRequest, NextResponse } from "next/server";
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
    const [profileRow] = await db
      .select({ id: users.id, fullName: users.fullName, cedula: users.cedula, role: users.role, email: users.email })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    const [studentCount] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(users).where(eq(users.role, "student"));
    const [teacherCount] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(users).where(eq(users.role, "teacher"));
    const [courseCount] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(cursos).where(eq(cursos.activo, true));
    const [parentCount] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(users).where(eq(users.role, "parent"));

    const stats = {
      totalEstudiantes: studentCount?.count || 0,
      totalProfesores: teacherCount?.count || 0,
      totalPadres: parentCount?.count || 0,
      totalCursos: courseCount?.count || 0,
    };

    const data = await db
      .select({
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
      .orderBy(desc(cursos.createdAt));

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

    const allTeachers = await db
      .select({ id: users.id, fullName: users.fullName, cedula: users.cedula, email: users.email })
      .from(users)
      .where(eq(users.role, "teacher"))
      .orderBy(users.fullName);

    const allSubjects = await db.select().from(subjects).orderBy(subjects.name);

    return NextResponse.json({ profile: profileRow, stats, courses, teachers: allTeachers, subjects: allSubjects });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    return NextResponse.json({ error: "Error al cargar dashboard" }, { status: 500 });
  }
}