/**
 * @swagger
 * /api/uploads/assignments/{filename}:
 *   get:
 *     summary: Servir archivo de tarea
 *     description: Sirve un archivo adjunto a una tarea (subido por el profesor) o a una entrega (subido por un estudiante). Verifica permisos según el rol del usuario.
 *     tags: [Archivos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema: { type: string }
 *         description: "Nombre del archivo (formato: teacher_{id}_{timestamp}_{name} o {assignmentId}_{studentId}_{timestamp}_{name})"
 *     responses:
 *       200:
 *         description: Archivo solicitado
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Nombre de archivo no válido
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tienes permiso para acceder a este archivo
 *       404:
 *         description: Archivo no encontrado
 *       500:
 *         description: Error interno
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignments, assignmentSubmissions, cursoProfesores, cursoEstudiantes } from "@/lib/db/schema";
import { eq, and, like } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { getFileBuffer, getBlobSignedUrl } from "@/lib/storage";

const MIME_MAP: Record<string, string> = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg",
  png: "image/png", webp: "image/webp", doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain", zip: "application/zip",
};
const INLINE_TYPES = ["pdf", "txt", "jpg", "jpeg", "png", "webp"];

function fileResponse(buffer: Buffer, filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const contentType = MIME_MAP[ext] || "application/octet-stream";
  const disposition = INLINE_TYPES.includes(ext) ? "inline" : "attachment";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "private, no-cache",
    },
  });
}

async function serveOrRedirect(safeName: string, displayName: string) {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const signedUrl = await getBlobSignedUrl(safeName);
    return NextResponse.redirect(signedUrl);
  }
  const fileBuffer = await getFileBuffer(safeName);
  return fileResponse(fileBuffer, displayName);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { filename } = await params;

    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    if (safeName !== filename) {
      return NextResponse.json({ error: "Nombre de archivo no valido" }, { status: 400 });
    }

    const parts = safeName.split("_");

    // Teacher attachment: teacher_{teacherId}_{timestamp}_{name}
    if (parts[0] === "teacher" && parts.length >= 4) {
      const teacherId = parseInt(parts[1]);
      if (isNaN(teacherId)) {
        return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
      }

      // Find the assignment with this file (the blob URL contains the filename)
      const [assgn] = await db
        .select({ id: assignments.id, fileUrl: assignments.fileUrl, cursoId: assignments.cursoId })
        .from(assignments)
        .where(and(
          eq(assignments.teacherId, teacherId),
          like(assignments.fileUrl, `%${safeName}%`),
        ))
        .limit(1);

      if (!assgn?.fileUrl) {
        return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
      }

      if (user.role === "teacher" && user.id === teacherId) {
        return serveOrRedirect(safeName, safeName);
      }

      // Students can access if enrolled in the course
      if (user.role === "student" && assgn.cursoId) {
        const [enrolled] = await db
          .select({ id: cursoEstudiantes.id })
          .from(cursoEstudiantes)
          .where(and(
            eq(cursoEstudiantes.estudianteId, user.id),
            eq(cursoEstudiantes.cursoId, assgn.cursoId)
          ))
          .limit(1);

        if (enrolled) {
          return serveOrRedirect(safeName, safeName);
        }
      }

      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Student submission: {assignmentId}_{studentId}_{timestamp}_{name}
    if (parts.length < 3) {
      return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
    }

    const assignmentId = parseInt(parts[0]);
    const studentId = parseInt(parts[1]);

    if (isNaN(assignmentId) || isNaN(studentId)) {
      return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
    }

    const [sub] = await db
      .select({ fileUrl: assignmentSubmissions.fileUrl })
      .from(assignmentSubmissions)
      .where(and(
        eq(assignmentSubmissions.assignmentId, assignmentId),
        eq(assignmentSubmissions.studentId, studentId),
        like(assignmentSubmissions.fileUrl, `%${safeName}%`),
      ))
      .limit(1);

    if (!sub?.fileUrl) {
      return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
    }

    if (user.role === "student" && user.id !== studentId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    if (user.role === "teacher") {
      const [assignment] = await db
        .select({ cursoId: assignments.cursoId })
        .from(assignments)
        .where(eq(assignments.id, assignmentId))
        .limit(1);

      if (!assignment?.cursoId) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }

      const teacherCourses = await db
        .select({ cursoId: cursoProfesores.cursoId })
        .from(cursoProfesores)
        .where(eq(cursoProfesores.teacherId, user.id));

      const isTeacherOfCourse = teacherCourses.some(
        (c) => c.cursoId === assignment.cursoId
      );

      if (!isTeacherOfCourse) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
    }

    return serveOrRedirect(safeName, safeName);
  } catch (error) {
    console.error("File serve error:", error);
    return NextResponse.json({ error: "Error al servir archivo" }, { status: 500 });
  }
}
