import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { directMessages, users } from "@/lib/db/schema";
import { eq, and, desc, or } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

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
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { receiverId, content } = await request.json();
  if (!receiverId || !content?.trim()) {
    return NextResponse.json({ error: "Destinatario y mensaje requeridos" }, { status: 400 });
  }

  const [msg] = await db.insert(directMessages).values({
    senderId: user.id,
    receiverId,
    content: content.trim(),
  } as any).returning();

  return NextResponse.json({ message: msg });
}
