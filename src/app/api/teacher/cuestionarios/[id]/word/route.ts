/**
 * @swagger
 * /api/teacher/cuestionarios/{id}/word:
 *   get:
 *     summary: Exportar cuestionario a Word
 *     description: Genera y descarga un archivo .doc (Word) con el contenido del cuestionario, incluyendo preguntas, opciones y respuestas correctas.
 *     tags: [Docentes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del cuestionario
 *     responses:
 *       200:
 *         description: Archivo Word del cuestionario
 *         content:
 *           application/msword:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Cuestionario no encontrado
 *       500:
 *         description: Error interno
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  cuestionarios, cuestionarioPreguntas, subjects, cursos, users,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return new Response("No autorizado", { status: 401 });
  }

  try {
    const { id } = await params;

    const [cuestionario] = await db
      .select({
        title: cuestionarios.title,
        description: cuestionarios.description,
        subjectName: subjects.name,
        subjectEmoji: subjects.emoji,
        cursoNombre: cursos.nombre,
        teacherName: users.fullName,
        createdAt: cuestionarios.createdAt,
      })
      .from(cuestionarios)
      .innerJoin(subjects, eq(subjects.id, cuestionarios.subjectId))
      .leftJoin(cursos, eq(cursos.id, cuestionarios.cursoId))
      .innerJoin(users, eq(users.id, cuestionarios.teacherId))
      .where(eq(cuestionarios.id, parseInt(id)))
      .limit(1);

    if (!cuestionario) {
      return new Response("Cuestionario no encontrado", { status: 404 });
    }

    const preguntas = await db
      .select({
        question: cuestionarioPreguntas.question,
        options: cuestionarioPreguntas.options,
        correctIndex: cuestionarioPreguntas.correctIndex,
        explanation: cuestionarioPreguntas.explanation,
        orderIndex: cuestionarioPreguntas.orderIndex,
      })
      .from(cuestionarioPreguntas)
      .where(eq(cuestionarioPreguntas.cuestionarioId, parseInt(id)))
      .orderBy(cuestionarioPreguntas.orderIndex);

    const fecha = cuestionario.createdAt
      ? new Date(cuestionario.createdAt).toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" })
      : "";

    let html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: 'Calibri', 'Arial', sans-serif; margin: 40px; color: #1e293b; }
  h1 { font-size: 22pt; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
  .meta { font-size: 11pt; color: #64748b; margin-bottom: 16px; }
  .description { font-size: 11pt; color: #475569; margin-bottom: 20px; line-height: 1.5; }
  .question { margin: 20px 0; padding: 12px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #6366f1; }
  .q-text { font-size: 12pt; font-weight: bold; color: #1e293b; margin-bottom: 8px; }
  .option { margin: 4px 0 4px 24px; font-size: 11pt; }
  .correct { color: #16a34a; font-weight: bold; }
  .incorrect { color: #475569; }
  .explanation { margin-top: 8px; padding: 8px; background: #eef2ff; border-radius: 6px; font-size: 10pt; color: #4338ca; }
  .footer { margin-top: 30px; font-size: 9pt; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; }
</style>
</head>
<body>
<h1>${escapeHtml(cuestionario.title || "Cuestionario de Estudio")}</h1>
<div class="meta">
  <strong>${escapeHtml(cuestionario.subjectName)}</strong>${cuestionario.cursoNombre ? ` - ${escapeHtml(cuestionario.cursoNombre)}` : ""}
  | Docente: ${escapeHtml(cuestionario.teacherName)}
  ${fecha ? `| Fecha: ${fecha}` : ""}
</div>
${cuestionario.description ? `<div class="description">${escapeHtml(cuestionario.description)}</div>` : ""}
<p style="font-size:11pt;color:#64748b;margin-bottom:16px;"><strong>${preguntas.length} preguntas</strong></p>`;

    for (let i = 0; i < preguntas.length; i++) {
      const p = preguntas[i];
      const options = (p.options as string[]) || [];

      html += `<div class="question">
<div class="q-text">${i + 1}. ${escapeHtml(p.question)}</div>`;

      for (let j = 0; j < options.length; j++) {
        const isCorrect = j === p.correctIndex;
        const optLetter = String.fromCharCode(65 + j);
        html += `<div class="option ${isCorrect ? 'correct' : 'incorrect'}">
${isCorrect ? '✓ ' : '&nbsp;&nbsp;&nbsp;'}${optLetter}) ${escapeHtml(options[j])}${isCorrect ? ' <span style="font-size:9pt;color:#16a34a;">(CORRECTA)</span>' : ''}</div>`;
      }

      if (p.explanation) {
        html += `<div class="explanation">💡 ${escapeHtml(p.explanation)}</div>`;
      }

      html += `</div>`;
    }

    html += `<div class="footer">Generado por Atlas Edu - Plataforma Educativa</div>
</body>
</html>`;

    const buffer = Buffer.from(html, "utf-8");

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/msword",
        "Content-Disposition": `attachment; filename="cuestionario-${id}.doc"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("[teacher word] error:", error);
    return new Response("Error al generar Word", { status: 500 });
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
