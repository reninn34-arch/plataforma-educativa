/**
 * @swagger
 * /api/teacher/asistencia/{cursoId}:
 *   get:
 *     summary: Obtener asistencia de un curso
 *     description: Devuelve el registro de asistencia de los estudiantes de un curso para una fecha específica.
 *     tags: [Docentes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cursoId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del curso
 *       - in: query
 *         name: fecha
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha en formato YYYY-MM-DD (por defecto hoy)
 *     responses:
 *       200:
 *         description: Registro de asistencia
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 fecha: { type: string }
 *                 asistencia:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       studentId: { type: integer }
 *                       studentName: { type: string }
 *                       cedula: { type: string }
 *                       estado: { type: string, enum: [presente, ausente, justificado, pendiente] }
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo docentes
 *       500:
 *         description: Error interno
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { asistencia, users, cursoEstudiantes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { teacherHasCourseAccess } from "@/lib/course-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cursoId: string }> }
) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "Solo docentes" }, { status: 403 });
  }

  try {
    const { cursoId } = await params;
    const cid = parseInt(cursoId);

    const hasAccess = await teacherHasCourseAccess(user.id, cid);
    if (!hasAccess) {
      return NextResponse.json({ error: "No tienes acceso a este curso" }, { status: 403 });
    }

    const fecha = request.nextUrl.searchParams.get("fecha") || new Date().toISOString().slice(0, 10);

    const data = await db
      .select({
        studentId: asistencia.studentId,
        studentName: users.fullName,
        cedula: users.cedula,
        estado: asistencia.estado,
        fecha: asistencia.fecha,
      })
      .from(asistencia)
      .innerJoin(users, eq(users.id, asistencia.studentId))
      .where(
        and(
          eq(asistencia.cursoId, cid),
          eq(asistencia.fecha, new Date(fecha))
        )
      )
      .orderBy(users.fullName);

    const enrolled = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        cedula: users.cedula,
      })
      .from(users)
      .innerJoin(cursoEstudiantes, eq(cursoEstudiantes.estudianteId, users.id))
      .where(
        and(
          eq(cursoEstudiantes.cursoId, cid),
          eq(users.activo, true)
        )
      )
      .orderBy(users.fullName);

    const attendanceMap = new Map(data.map((r: any) => [r.studentId, r.estado]));
    const allStudents = enrolled.map((s: any) => ({
      studentId: s.id,
      studentName: s.fullName,
      cedula: s.cedula,
      estado: attendanceMap.get(s.id) || "pendiente",
    }));

    return NextResponse.json({ fecha, asistencia: allStudents });
  } catch (error) {
    console.error("Attendance fetch error:", error);
    return NextResponse.json({ error: "Error al cargar asistencia" }, { status: 500 });
  }
}
