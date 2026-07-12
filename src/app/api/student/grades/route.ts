/**
 * @swagger
 * /api/student/grades:
 *   get:
 *     summary: Calificaciones del estudiante
 *     description: Devuelve las calificaciones de tareas, trabajos pendientes, resumen por materia y promedio general del estudiante autenticado.
 *     tags: [Estudiantes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Calificaciones del estudiante
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 graded:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       assignmentId: { type: integer }
 *                       assignmentTitle: { type: string }
 *                       subjectName: { type: string }
 *                       subjectEmoji: { type: string }
 *                       trimester: { type: integer }
 *                       grade: { type: number, nullable: true }
 *                       feedback: { type: string, nullable: true }
 *                       status: { type: string }
 *                       submittedAt: { type: string, nullable: true }
 *                       puntos: { type: integer }
 *                 pending:
 *                   type: array
 *                   items:
 *                     type: object
 *                 notSubmittedCount: { type: integer }
 *                 summary:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       subjectName: { type: string }
 *                       subjectEmoji: { type: string }
 *                       t1Avg: { type: number, nullable: true }
 *                       t2Avg: { type: number, nullable: true }
 *                       t3Avg: { type: number, nullable: true }
 *                       yearlyAvg: { type: number, nullable: true }
 *                 generalAvg: { type: number, nullable: true }
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignments, assignmentSubmissions, subjects } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "student") return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
  const data = await db
    .select({
      id: assignmentSubmissions.id,
      assignmentId: assignments.id,
      assignmentTitle: assignments.title,
      subjectName: subjects.name,
      subjectEmoji: subjects.emoji,
      trimester: assignments.trimester,
      grade: assignmentSubmissions.grade,
      feedback: assignmentSubmissions.feedback,
      status: assignmentSubmissions.status,
      submittedAt: assignmentSubmissions.submittedAt,
      puntos: assignments.puntos,
    })
    .from(assignmentSubmissions)
    .leftJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id))
    .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
    .where(eq(assignmentSubmissions.studentId, user.id))
    .orderBy(desc(assignmentSubmissions.submittedAt))
    .limit(200);

  const graded = data.filter(r => r.grade !== null);
  const pending = data.filter(r => r.status === "submitted" && r.grade === null);
  const notSubmitted = data.filter(r => r.status === "pending");

  const subjectMap = new Map<string, { name: string; emoji: string; t1: { grades: number[]; puntos: number[] }; t2: { grades: number[]; puntos: number[] }; t3: { grades: number[]; puntos: number[] }; all: { grades: number[]; puntos: number[] } }>();
  graded.forEach(row => {
    const key = row.subjectName || "Sin materia";
    if (!subjectMap.has(key)) subjectMap.set(key, { name: row.subjectName || "", emoji: row.subjectEmoji || "", t1: { grades: [], puntos: [] }, t2: { grades: [], puntos: [] }, t3: { grades: [], puntos: [] }, all: { grades: [], puntos: [] } });
    const s = subjectMap.get(key)!;
    if (row.grade !== null) {
      const pt = row.puntos || 10;
      s.all.grades.push(row.grade);
      s.all.puntos.push(pt);
      if (row.trimester === 1) { s.t1.grades.push(row.grade); s.t1.puntos.push(pt); }
      if (row.trimester === 2) { s.t2.grades.push(row.grade); s.t2.puntos.push(pt); }
      if (row.trimester === 3) { s.t3.grades.push(row.grade); s.t3.puntos.push(pt); }
    }
  });

  const weightedAvg = (grades: number[], puntos: number[]) => {
    if (grades.length === 0) return null;
    const totalPts = puntos.reduce((a, b) => a + b, 0);
    if (totalPts === 0) return null;
    return Math.round((grades.reduce((sum, g, i) => sum + g * puntos[i], 0) / totalPts) * 100) / 100;
  };

  const summary = Array.from(subjectMap.entries()).map(([_, s]) => ({
    subjectName: s.name,
    subjectEmoji: s.emoji,
    t1Avg: weightedAvg(s.t1.grades, s.t1.puntos),
    t2Avg: weightedAvg(s.t2.grades, s.t2.puntos),
    t3Avg: weightedAvg(s.t3.grades, s.t3.puntos),
    yearlyAvg: (() => {
      const t1 = weightedAvg(s.t1.grades, s.t1.puntos);
      const t2 = weightedAvg(s.t2.grades, s.t2.puntos);
      const t3 = weightedAvg(s.t3.grades, s.t3.puntos);
      const vals = [t1, t2, t3].filter(v => v !== null);
      return vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : null;
    })(),
  }));

  const allAvgs = summary.flatMap(g => [g.t1Avg, g.t2Avg, g.t3Avg].filter(v => v !== null));
  const generalAvg = allAvgs.length > 0
    ? Math.round((allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length) * 100) / 100
    : null;

  return NextResponse.json({
    graded,
    pending,
    notSubmittedCount: notSubmitted.length,
    summary,
    generalAvg,
  });
  } catch {
    return NextResponse.json({ error: "Error al cargar calificaciones" }, { status: 500 });
  }
}
