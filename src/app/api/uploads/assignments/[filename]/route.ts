import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { db } from "@/lib/db";
import { assignments, cursoProfesores, cursoEstudiantes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
const UPLOADS_DIR = join(process.cwd(), "uploads", "assignments");

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
      const filePath = join(UPLOADS_DIR, safeName);
      if (!existsSync(filePath)) {
        return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
      }

      const teacherId = parseInt(parts[1]);
      if (isNaN(teacherId)) {
        return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
      }

      // Teachers can access their own uploads
      if (user.role === "teacher" && user.id === teacherId) {
        const fileBuffer = await readFile(filePath);
        const ext = safeName.split(".").pop()?.toLowerCase() || "";
        const mimeMap: Record<string, string> = {
          pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg",
          png: "image/png", webp: "image/webp", doc: "application/msword",
          docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          txt: "text/plain", zip: "application/zip",
        };
        const contentType = mimeMap[ext] || "application/octet-stream";
        const inlineTypes = ["pdf", "txt", "jpg", "jpeg", "png", "webp"];
        const disposition = inlineTypes.includes(ext) ? "inline" : "attachment";
        return new NextResponse(fileBuffer, {
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": `${disposition}; filename="${safeName}"`,
            "Cache-Control": "private, no-cache",
          },
        });
      }

      // Students can access teacher attachments if enrolled in a course that has this assignment
      if (user.role === "student") {
        // Find assignment by fileUrl in the DB
        const [assgn] = await db
          .select({ id: assignments.id, cursoId: assignments.cursoId })
          .from(assignments)
          .where(eq(assignments.fileUrl, `/api/uploads/assignments/${safeName}`))
          .limit(1);

        if (assgn?.cursoId) {
          const [enrolled] = await db
            .select({ id: cursoEstudiantes.id })
            .from(cursoEstudiantes)
            .where(and(
              eq(cursoEstudiantes.estudianteId, user.id),
              eq(cursoEstudiantes.cursoId, assgn.cursoId)
            ))
            .limit(1);

          if (enrolled) {
            const fileBuffer = await readFile(filePath);
            const ext = safeName.split(".").pop()?.toLowerCase() || "";
            const mimeMap: Record<string, string> = {
              pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg",
              png: "image/png", webp: "image/webp", doc: "application/msword",
              docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              txt: "text/plain", zip: "application/zip",
            };
            const contentType = mimeMap[ext] || "application/octet-stream";
            const inlineTypes = ["pdf", "txt", "jpg", "jpeg", "png", "webp"];
            const disposition = inlineTypes.includes(ext) ? "inline" : "attachment";
            return new NextResponse(fileBuffer, {
              headers: {
                "Content-Type": contentType,
                "Content-Disposition": `${disposition}; filename="${safeName}"`,
                "Cache-Control": "private, no-cache",
              },
            });
          }
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

    const filePath = join(UPLOADS_DIR, safeName);

    if (!existsSync(filePath)) {
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

    const fileBuffer = await readFile(filePath);
    const ext = safeName.split(".").pop()?.toLowerCase() || "";
    const mimeMap: Record<string, string> = {
      pdf: "application/pdf",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      txt: "text/plain",
      zip: "application/zip",
    };

    const contentType = mimeMap[ext] || "application/octet-stream";
    const inlineTypes = ["pdf", "txt", "jpg", "jpeg", "png", "webp"];
    const disposition = inlineTypes.includes(ext) ? "inline" : "attachment";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${disposition}; filename="${safeName}"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (error) {
    console.error("File serve error:", error);
    return NextResponse.json({ error: "Error al servir archivo" }, { status: 500 });
  }
}
