/**
 * @swagger
 * /api/assignments/{id}/export:
 *   get:
 *     summary: Exportar tarea a Word
 *     description: Genera un documento .doc compatible con Microsoft Word con la tarea, sus preguntas y formato para impresión. Solo profesores (dueños) y administradores.
 *     tags: [Tareas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: ID de la tarea
 *     responses:
 *       200:
 *         description: Documento Word generado
 *         content:
 *           application/msword:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tienes permiso para exportar esta tarea
 *       404:
 *         description: Tarea no encontrada
 *       500:
 *         description: Error interno
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { assignments, assignmentQuestions, subjects, users, cursos } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get("atlas-edu-token")?.value;
    const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
    if (!user || (user.role !== "teacher" && user.role !== "admin")) {
      return new Response("No autorizado", { status: 401 });
    }

    const { id } = await params;
    const assignmentId = parseInt(id);

    const [assignment] = await db
      .select({
        id: assignments.id,
        teacherId: assignments.teacherId,
        title: assignments.title,
        description: assignments.description,
        subjectName: subjects.name,
        subjectEmoji: subjects.emoji,
        cursoNombre: cursos.nombre,
        cursoNivel: cursos.nivel,
        trimester: assignments.trimester,
        puntos: assignments.puntos,
        teacherName: users.fullName,
      })
      .from(assignments)
      .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
      .leftJoin(users, eq(assignments.teacherId, users.id))
      .leftJoin(cursos, eq(assignments.cursoId, cursos.id))
      .where(eq(assignments.id, assignmentId));

    if (!assignment) {
      return new Response("Tarea no encontrada", { status: 404 });
    }

    // Teachers can only export their own assignments; admins can export any
    if (user.role === "teacher" && assignment.teacherId !== user.id) {
      return new Response("No tienes permiso para exportar esta tarea", { status: 403 });
    }

    const questions = await db
      .select()
      .from(assignmentQuestions)
      .where(eq(assignmentQuestions.assignmentId, assignmentId))
      .orderBy(asc(assignmentQuestions.orderIndex));

    const cleanFileName = (assignment.title || "examen")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .slice(0, 50);

    const evaluationLabel = assignment.title.includes("Plantilla") || assignment.title.includes("Examen") 
      ? "EVALUACIÓN ESCRITA" 
      : "ACTIVIDAD DE EVALUACIÓN";

    // Build the Word-compatible HTML content
    let htmlContent = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8">
  <title>${assignment.title}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page {
      size: A4;
      margin: 2.5cm 2.5cm 2.5cm 2.5cm;
    }
    body {
      font-family: 'Arial', sans-serif;
      font-size: 11pt;
      line-height: 1.4;
      color: #000000;
    }
    .header-title {
      font-size: 16pt;
      font-weight: bold;
      text-align: center;
      text-transform: uppercase;
      margin-bottom: 2pt;
    }
    .header-subtitle {
      font-size: 12pt;
      font-weight: bold;
      text-align: center;
      margin-bottom: 12pt;
      border-bottom: 2px double #000;
      padding-bottom: 6pt;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 18pt;
    }
    .meta-table td {
      border: 1px solid #000000;
      padding: 6pt;
      font-size: 10pt;
    }
    .instructions-box {
      border: 1px solid #000000;
      padding: 8pt;
      margin-bottom: 18pt;
      font-style: italic;
      font-size: 9.5pt;
      background-color: #f9f9f9;
    }
    .question-container {
      margin-bottom: 16pt;
      page-break-inside: avoid;
    }
    .question-text {
      font-weight: bold;
      margin-bottom: 6pt;
    }
    .options-container {
      margin-left: 18pt;
      margin-bottom: 10pt;
    }
    .option-item {
      margin-bottom: 4pt;
    }
    .option-box {
      display: inline-block;
      width: 12pt;
      height: 12pt;
      border: 1px solid #000000;
      margin-right: 6pt;
      text-align: center;
      vertical-align: middle;
    }
    .open-answer-line {
      margin-top: 8pt;
      margin-bottom: 8pt;
      border-bottom: 1px solid #000000;
      height: 24pt;
    }
    .footer-section {
      margin-top: 40pt;
      width: 100%;
      text-align: center;
      page-break-inside: avoid;
    }
    .signature-line {
      width: 200px;
      border-top: 1px solid #000;
      margin: 40pt auto 5pt auto;
      text-align: center;
      font-size: 10pt;
    }
  </style>
</head>
<body>

  <div class="header-title">ATLAS EDU - PLATAFORMA EDUCATIVA</div>
  <div class="header-subtitle">${evaluationLabel} - ${assignment.subjectEmoji} ${assignment.subjectName}</div>

  <table class="meta-table">
    <tr>
      <td style="width: 60%;"><strong>Estudiante:</strong> _________________________________________________</td>
      <td style="width: 40%;"><strong>Fecha:</strong> ____/____/______</td>
    </tr>
    <tr>
      <td><strong>Curso/Nivel:</strong> ${assignment.cursoNombre || "General"} (${assignment.cursoNivel || ""})</td>
      <td><strong>Trimestre:</strong> ${assignment.trimester || 1}</td>
    </tr>
    <tr>
      <td><strong>Docente:</strong> ${assignment.teacherName || "N/A"}</td>
      <td><strong>Calificación:</strong> ________ / ${assignment.puntos || 10} pts</td>
    </tr>
  </table>

  <div class="instructions-box">
    <strong>Instrucciones Generales:</strong><br/>
    ${assignment.description || "Lea atentamente cada una de las preguntas antes de responder. Responda con letra clara y evite tachones."}
  </div>

  <div style="margin-top: 10pt;">
`;

    questions.forEach((q, index) => {
      const pointsText = `(${q.points || 1} ${q.points === 1 ? "punto" : "puntos"})`;
      htmlContent += `
    <div class="question-container">
      <div class="question-text">${index + 1}. ${q.question} <span style="font-weight: normal; font-size: 9.5pt;">${pointsText}</span></div>
`;

      if (q.type === "mcq" && Array.isArray(q.options)) {
        htmlContent += `      <div class="options-container">\n`;
        q.options.forEach((opt, oIndex) => {
          const letter = String.fromCharCode(65 + oIndex); // A, B, C, D
          htmlContent += `        <div class="option-item">[  ] &nbsp;<strong>${letter}.</strong> ${opt}</div>\n`;
        });
        htmlContent += `      </div>\n`;
      } else {
        // File upload / open question -> Render write-in blank lines
        htmlContent += `
      <div style="margin-left: 10pt; margin-top: 5pt;">
        <div class="open-answer-line"></div>
        <div class="open-answer-line"></div>
        <div class="open-answer-line"></div>
      </div>
`;
      }

      htmlContent += `    </div>\n`;
    });

    htmlContent += `
  </div>

  <table style="width: 100%; margin-top: 50pt; page-break-inside: avoid;">
    <tr>
      <td style="width: 50%; text-align: center;">
        <div class="signature-line">Firma del Estudiante</div>
      </td>
      <td style="width: 50%; text-align: center;">
        <div class="signature-line">Firma del Docente</div>
      </td>
    </tr>
  </table>

</body>
</html>
`;

    return new Response(htmlContent, {
      headers: {
        "Content-Type": "application/msword; charset=utf-8",
        "Content-Disposition": `attachment; filename="${cleanFileName}.doc"`,
      },
    });
  } catch (error) {
    console.error("Export endpoint error:", error);
    return new Response("Error al exportar la tarea", { status: 500 });
  }
}
