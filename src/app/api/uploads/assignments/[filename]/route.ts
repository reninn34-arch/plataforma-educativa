import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignments, assignmentSubmissions, cursoProfesores, cursoEstudiantes } from "@/lib/db/schema";
import { eq, and, like } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { getFileBuffer } from "@/lib/storage";

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

      // Teachers can access their own uploads
      if (user.role === "teacher" && user.id === teacherId) {
        const fileBuffer = await getFileBuffer(assgn.fileUrl);
        return fileResponse(fileBuffer, safeName);
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
          const fileBuffer = await getFileBuffer(assgn.fileUrl);
          return fileResponse(fileBuffer, safeName);
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

    const fileBuffer = await getFileBuffer(sub.fileUrl);
    return fileResponse(fileBuffer, safeName);
  } catch (error) {
    console.error("File serve error:", error);
    return NextResponse.json({ error: "Error al servir archivo" }, { status: 500 });
  }
}
