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
  fileUrl: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  trimester: z.number().int().min(1).max(3).optional(),
  questions: z.array(z.object({
    type: z.enum(["mcq", "file_upload"]),
    question: z.string(),
    options: z.array(z.string()).optional().nullable(),
    correctIndex: z.number().int().min(0).optional().nullable(),
    points: z.number().int().min(0).optional(),
    orderIndex: z.number().int().optional(),
  })).optional(),
});

const COMMON_PINS = [
  "0000","1111","2222","3333","4444","5555","6666","7777","8888","9999",
  "0123","1234","2345","3456","4567","5678","6789","7890",
  "1122","2233","3344","4455","5566","6677","7788","8899",
  "3210","4321","5432","6543","7654","8765","9876",
  "0101","1010","1212","2020","2525","3636","4545",
  "0001","0007","0010","0100","1000","1110","1234","2000","2001",
  "2222","2580","3333","4444","5555","6666","7777","8888","9999",
  "abcd","admin","pass","0007","0000","1234","1","1111","11","1212",
  "123456","12345678","12345","password","qwerty","abc123",
];

export function isValidPin(pin: string): { valid: boolean; reason?: string } {
  if (!/^\d{4}$/.test(pin)) {
    return { valid: false, reason: "El PIN debe tener exactamente 4 dígitos" };
  }
  if (COMMON_PINS.includes(pin)) {
    return { valid: false, reason: "Este PIN es demasiado común. Elige uno más seguro." };
  }
  if (/(\d)\1{3}/.test(pin)) {
    return { valid: false, reason: "El PIN no debe tener todos los dígitos iguales" };
  }
  if (/^(\d)\1{2,}/.test(pin)) {
    return { valid: false, reason: "Evita dígitos repetidos en tu PIN" };
  }
  const asc = /^0?1?2?3?4?5?6?7?8?9?$/.test(pin);
  const desc = /^9?8?7?6?5?4?3?2?1?0?$/.test(pin);
  if (asc || desc) {
    return { valid: false, reason: "Evita secuencias numéricas (ej: 1234, 4321)" };
  }
  return { valid: true };
}

export const profileSchema = z.object({
  fullName: z.string().min(1).optional(),
  currentPin: z.string().regex(/^\d{4}$/, "PIN actual debe tener 4 dígitos"),
  newPin: z.string().regex(/^\d{4}$/, "Nuevo PIN debe tener 4 dígitos"),
});
