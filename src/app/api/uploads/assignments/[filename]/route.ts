import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { db } from "@/lib/db";
import { assignments, cursoProfesores } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
const UPLOADS_DIR = join(process.cwd(), "uploads", "assignments");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;

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
