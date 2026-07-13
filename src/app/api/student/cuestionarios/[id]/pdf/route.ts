/**
 * @swagger
 * /api/student/cuestionarios/{id}/pdf:
 *   get:
 *     summary: Exportar cuestionario a PDF
 *     description: Genera y descarga un archivo PDF con las preguntas, opciones y respuestas correctas de un cuestionario.
 *     tags: [Estudiantes]
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
 *         description: Archivo PDF del cuestionario
 *         content:
 *           application/pdf:
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
  cuestionarios, cuestionarioPreguntas, subjects, cursos,
  users,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import jsPDF from "jspdf";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "student") {
    return new Response("No autorizado", { status: 401 });
  }

  try {
    const { id } = await params;

    const [cuestionario] = await db
      .select({
        id: cuestionarios.id,
        title: cuestionarios.title,
        description: cuestionarios.description,
        subjectName: subjects.name,
        subjectEmoji: subjects.emoji,
        subjectSlug: subjects.slug,
        cursoNombre: cursos.nombre,
        cursoNivel: cursos.nivel,
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

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = 210;
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    function addText(text: string, size: number, style: "normal" | "bold" | "italic" = "normal", color?: [number, number, number]) {
      if (y > 270) {
        doc.addPage();
        y = margin;
      }
      doc.setFontSize(size);
      doc.setFont("helvetica", style);
      if (color) doc.setTextColor(color[0], color[1], color[2]);
      const lines = doc.splitTextToSize(text, contentWidth);
      doc.text(lines, margin, y);
      y += lines.length * (size * 0.45) + 3;
    }

    // Title
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(cuestionario.title || "Cuestionario de Estudio", margin, y);
    y += 10;

    // Meta
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    const meta = `${cuestionario.subjectName}${cuestionario.cursoNombre ? ` - ${cuestionario.cursoNombre}` : ""} | Docente: ${cuestionario.teacherName}`;
    doc.text(meta, margin, y);
    y += 5;

    const fecha = cuestionario.createdAt
      ? new Date(cuestionario.createdAt).toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" })
      : "";
    doc.text(`Fecha de creacion: ${fecha}`, margin, y);
    y += 10;

    // Description
    if (cuestionario.description) {
      addText(cuestionario.description, 10, "normal", [71, 85, 105]);
      y += 3;
    }

    // Divider
    y += 3;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Questions
    for (let i = 0; i < preguntas.length; i++) {
      const p = preguntas[i];
      const letter = String.fromCharCode(65 + i);

      // Question header
      addText(`${letter}) ${p.question}`, 11, "bold", [30, 41, 59]);

      // Options
      const options = (p.options as string[]) || [];
      for (let j = 0; j < options.length; j++) {
        const optLetter = String.fromCharCode(65 + j);
        const isCorrect = j === p.correctIndex;
        const prefix = isCorrect ? "✓ " : "   ";
        const optText = `${prefix}${optLetter}) ${options[j]}`;
        if (isCorrect) {
          addText(optText, 10, "bold", [22, 163, 74]);
        } else {
          addText(optText, 10, "normal", [71, 85, 105]);
        }
      }

      // Explanation
      if (p.explanation) {
        addText(`💡 ${p.explanation}`, 9, "italic", [100, 116, 139]);
      }

      y += 3;

      // Separator between questions
      if (i < preguntas.length - 1) {
        doc.setDrawColor(241, 245, 249);
        doc.line(margin, y, pageWidth - margin, y);
        y += 5;
      }
    }

    // Footer
    y = Math.max(y, 270);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text("Generado por Atlas Edu - Plataforma Educativa", margin, y + 10);

    const pdfBytes = doc.output("arraybuffer");
    const uint8 = new Uint8Array(pdfBytes);

    return new Response(uint8, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="cuestionario-${id}.pdf"`,
        "Content-Length": uint8.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("[cuestionario pdf] error:", error);
    return new Response("Error al generar PDF", { status: 500 });
  }
}
