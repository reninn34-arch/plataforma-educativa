import { z } from "zod/v4";
import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

export function apiError(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function apiSuccess<T>(data: T, status: number = 200) {
  return NextResponse.json({ success: true, ...data as any }, { status });
}

export async function requireAuth(request: Request) {
  const token = request.headers.get("cookie")?.match(/atlas-edu-token=([^;]+)/)?.[1]
    ?? (request as any).cookies?.get?.("atlas-edu-token")?.value;

  if (!token) return { user: null, error: apiError("No autorizado", 401) };
  const user = await verifyToken(token);
  if (!user) return { user: null, error: apiError("Sesion expirada", 401) };
  return { user, error: null };
}

// --- Shared request body schemas ---

export const loginSchema = z.object({
  cedula: z.string().regex(/^\d{10}$/, "Cedula debe tener 10 digitos"),
  pin: z.string().regex(/^\d{4}$/, "PIN debe tener 4 digitos"),
});

export const chatSchema = z.object({
  messages: z.array(z.any()).min(1, "messages es requerido"),
  subject: z.string().min(1, "subject es requerido"),
  model: z.string().min(1).optional(),
});

export const coachSchema = z.object({
  question: z.string().min(1),
  studentAnswer: z.string(),
  topic: z.string().optional(),
  wasTimeout: z.boolean().optional(),
  model: z.string().min(1).optional(),
});

export const pathGenerateSchema = z.object({
  subject: z.string().min(1),
  topic: z.string().min(3, "topic debe tener al menos 3 caracteres"),
  model: z.string().min(1).optional(),
});

export const practiceGenerateSchema = z.object({
  subject: z.string().min(1),
  topic: z.string().optional(),
  aiPromptContext: z.string().optional(),
  nodeId: z.number().optional(),
  retry: z.boolean().optional(),
  model: z.string().min(1).optional(),
});

export const practiceCheckSchema = z.object({
  question: z.string(),
  type: z.enum(["mcq", "fill_blank", "true_false"]),
  studentAnswer: z.union([z.string(), z.number(), z.boolean()]),
  correctAnswer: z.any(),
  options: z.array(z.string()).optional(),
  model: z.string().min(1).optional(),
});

export const studyMaterialSchema = z.object({
  subject: z.string().min(1),
  topic: z.string().optional(),
  model: z.string().min(1).optional(),
});

export const embeddingSchema = z.object({
  text: z.string().min(1, "text es requerido").max(8000, "text no puede exceder 8000 caracteres"),
  model: z.string().min(1).optional(),
});

export const embeddingSimilaritySchema = z.object({
  query: z.string().min(1, "query es requerido").max(4000, "query no puede exceder 4000 caracteres"),
  candidates: z.array(z.string().min(1).max(4000)).min(1, "candidates es requerido").max(50, "candidates no puede exceder 50 items"),
  topK: z.number().int().min(1).max(50).optional(),
  model: z.string().min(1).optional(),
});

export const messageSchema = z.object({
  receiverId: z.number().int().positive(),
  content: z.string().min(1, "El mensaje no puede estar vacio"),
});

export const assignmentSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  subjectId: z.number().int().positive().optional().nullable(),
  cursoId: z.number().int().positive().optional().nullable(),
  puntos: z.number().int().min(1).optional(),
  dueDate: z.string().optional(),
  trimester: z.number().int().min(1).max(3).optional(),
  questions: z.array(z.object({
    type: z.enum(["mcq", "file_upload"]),
    question: z.string().min(1),
    options: z.array(z.string()).optional().nullable(),
    correctIndex: z.number().int().min(0).optional().nullable(),
    points: z.number().int().min(0).optional(),
    orderIndex: z.number().int().optional(),
  })).optional(),
});

export const profileSchema = z.object({
  fullName: z.string().min(1).optional(),
  currentPin: z.string().regex(/^\d{4}$/).optional(),
  newPin: z.string().regex(/^\d{4}$/).optional(),
});
