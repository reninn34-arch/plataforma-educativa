import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { directMessages, users } from "@/lib/db/schema";
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
  });

  return NextResponse.json({ message: msg });
  } catch {
    return NextResponse.json({ error: "Error al enviar mensaje" }, { status: 500 });
  }
}
