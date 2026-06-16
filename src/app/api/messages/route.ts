import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { directMessages, users, cursoEstudiantes } from "@/lib/db/schema";
import { eq, or, and, desc } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { messageSchema } from "@/lib/api-helpers";
import { notifyUser } from "@/lib/notifications";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
  const contactId = parseInt(request.nextUrl.searchParams.get("contactId") || "0");

  if (contactId) {
    // Get conversation with specific contact
    const messages = await db
      .select()
      .from(directMessages)
      .where(
        or(
          and(eq(directMessages.senderId, user.id), eq(directMessages.receiverId, contactId)),
          and(eq(directMessages.senderId, contactId), eq(directMessages.receiverId, user.id))
        )
      )
      .orderBy(desc(directMessages.createdAt))
      .limit(50);

    // Mark as read
    await db
      .update(directMessages)
      .set({ read: true } as any)
      .where(and(eq(directMessages.receiverId, user.id), eq(directMessages.senderId, contactId)));

    return NextResponse.json({ messages: messages.reverse() });
  }

  // Get contact list (who has messaged with the user)
  const sent = await db
    .select({ contactId: directMessages.receiverId, contactName: users.fullName, contactRole: users.role })
    .from(directMessages)
    .leftJoin(users, eq(directMessages.receiverId, users.id))
    .where(eq(directMessages.senderId, user.id));

  const received = await db
    .select({ contactId: directMessages.senderId, contactName: users.fullName, contactRole: users.role })
    .from(directMessages)
    .leftJoin(users, eq(directMessages.senderId, users.id))
    .where(eq(directMessages.receiverId, user.id));

  // Merge and deduplicate contacts
  const contactMap = new Map<number, { contactId: number; contactName: string; contactRole: string }>();
  [...sent, ...received].forEach(c => {
    if (c.contactId && !contactMap.has(c.contactId)) {
      contactMap.set(c.contactId, { contactId: c.contactId, contactName: c.contactName || "", contactRole: c.contactRole || "" });
    }
  });

  return NextResponse.json({ contacts: Array.from(contactMap.values()) });
  } catch {
    return NextResponse.json({ error: "Error al cargar mensajes" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await request.json();

    // Check if sending message to a whole course
    if (body.cursoId !== undefined && body.cursoId !== null) {
      const cursoId = Number(body.cursoId);
      const messageText = body.message || body.content || "";
      if (!messageText.trim()) {
        return NextResponse.json({ error: "El mensaje no puede estar vacio" }, { status: 400 });
      }

      // Fetch active students in this course
      const students = await db
        .select({ id: users.id })
        .from(users)
        .innerJoin(cursoEstudiantes, eq(cursoEstudiantes.estudianteId, users.id))
        .where(and(eq(cursoEstudiantes.cursoId, cursoId), eq(users.activo, true)));

      if (students.length === 0) {
        return NextResponse.json({ error: "No hay estudiantes activos en este curso" }, { status: 400 });
      }

      // Insert message for each student and send notification
      for (const s of students) {
        await db.insert(directMessages).values({
          senderId: user.id,
          receiverId: s.id,
          content: messageText.trim(),
        } as any);

        await notifyUser({
          userId: s.id,
          type: "message",
          title: `Nuevo mensaje de ${user.role === "teacher" ? "tu profesor" : "un estudiante"}`,
          message: messageText.trim().slice(0, 120),
          link: `/messages?contact=${user.id}`,
        });
      }

      return NextResponse.json({ success: true, count: students.length });
    }

    // Normal single-user message
    const parsed = messageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { receiverId, content } = parsed.data;

    const [msg] = await db.insert(directMessages).values({
      senderId: user.id,
      receiverId,
      content,
    } as any).returning();

    await notifyUser({
      userId: receiverId,
      type: "message",
      title: `Nuevo mensaje de ${user.role === "teacher" ? "tu profesor" : "un estudiante"}`,
      message: content.slice(0, 120),
      link: `/messages?contact=${user.id}`,
    });

    return NextResponse.json({ message: msg });
  } catch (err: any) {
    console.error("Error in messages POST:", err);
    return NextResponse.json({ error: "Error al enviar mensaje" }, { status: 500 });
  }
}
