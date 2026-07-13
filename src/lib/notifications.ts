import { db } from "@/lib/db";
import { notificaciones } from "@/lib/db/schema";
import { cursoEstudiantes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type NotificationType = "assignment" | "message" | "deadline" | "grade" | "system" | "study_material";

export async function createNotification({
  userId,
  type,
  title,
  message,
  link,
  relatedId,
}: {
  userId: number;
  type: NotificationType;
  title: string;
  message?: string;
  link?: string;
  relatedId?: number;
}) {
  const [created] = await db.insert(notificaciones).values({
    userId,
    type,
    title,
    message: message || null,
    link: link || null,
    relatedId: relatedId || null,
  }).returning();
  return created;
}

export async function notifyStudentsInCourse({
  cursoId,
  type,
  title,
  message,
  link,
  relatedId,
  excludeUserId,
}: {
  cursoId: number;
  type: NotificationType;
  title: string;
  message?: string;
  link?: string;
  relatedId?: number;
  excludeUserId?: number;
}) {
  const enrolled = await db
    .select({ estudianteId: cursoEstudiantes.estudianteId })
    .from(cursoEstudiantes)
    .where(eq(cursoEstudiantes.cursoId, cursoId));

  const ids = excludeUserId
    ? enrolled.map(e => e.estudianteId).filter(id => id !== excludeUserId)
    : enrolled.map(e => e.estudianteId);

  if (ids.length === 0) return [];

  const values = ids.map(userId => ({
    userId,
    type,
    title,
    message: message || null,
    link: link || null,
    relatedId: relatedId || null,
  }));

  const created = await db.insert(notificaciones).values(values).returning();
  return created;
}

export async function notifyUser({
  userId,
  type,
  title,
  message,
  link,
  relatedId,
}: {
  userId: number;
  type: NotificationType;
  title: string;
  message?: string;
  link?: string;
  relatedId?: number;
}) {
  return createNotification({ userId, type, title, message, link, relatedId });
}
