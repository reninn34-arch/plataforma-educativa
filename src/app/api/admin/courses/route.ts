import { NextRequest, NextResponse } from "next/server";

/**
 * @swagger
 * /api/admin/courses:
 *   get:
 *     summary: Listar cursos
 *     description: Devuelve todos los cursos con conteo de estudiantes y profesores por materia.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de cursos
 *       403:
 *         description: Solo administradores
 *   post:
 *     summary: Crear curso
 *     description: Crea un nuevo curso asignándole tutor y nivel.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre, nivel]
 *             properties:
 *               nombre: { type: string, description: "Nombre del curso", example: "1ero BGU A" }
 *               nivel: { type: string, description: "Nivel educativo", example: "1ero BGU" }
 *               profesorId: { type: integer, description: "ID del profesor tutor" }
 *     responses:
 *       201:
 *         description: Curso creado
 *       403:
 *         description: Solo administradores
 */
import { db } from "@/lib/db";
import { cursos, cursoEstudiantes, users, subjects, cursoProfesores } from "@/lib/db/schema";
import { eq, inArray, desc, sql } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  try {
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

    const cursosWithTeachers = data.map(c => ({
      ...c,
      teacherSubjects: profsByCurso.get(c.id) || [],
    }));

    return NextResponse.json({ cursos: cursosWithTeachers });
  } catch (error) {
    console.error("Admin courses error:", error);
    return NextResponse.json({ error: "Error al cargar cursos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  try {
    const { nombre, nivel, profesorId, teacherSubjects: teacherSubjectsData } = await request.json();
    if (!nombre || !nivel) {
      return NextResponse.json({ error: "Nombre y nivel requeridos" }, { status: 400 });
    }

    const [created] = await db.insert(cursos).values({
      nombre,
      nivel,
      profesorId: profesorId || null,
    }).returning();

    if (teacherSubjectsData && Array.isArray(teacherSubjectsData) && teacherSubjectsData.length > 0) {
      await db.insert(cursoProfesores).values(
        teacherSubjectsData.map((ts: { teacherId: number; subjectId: number }) => ({
          cursoId: created.id,
          teacherId: ts.teacherId,
          subjectId: ts.subjectId,
        }))
      );
    }

    return NextResponse.json({ curso: created }, { status: 201 });
  } catch (error) {
    console.error("Admin create course error:", error);
    return NextResponse.json({ error: "Error al crear curso" }, { status: 500 });
  }
}
