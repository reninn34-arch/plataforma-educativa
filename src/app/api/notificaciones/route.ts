/**
 * @swagger
 * /api/notificaciones:
 *   get:
 *     summary: Listar notificaciones
 *     description: Obtiene las últimas 50 notificaciones del usuario autenticado y el conteo de no leídas.
 *     tags: [Notificaciones]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de notificaciones
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 notificaciones:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       type:
 *                         type: string
 *                       title:
 *                         type: string
 *                       message:
 *                         type: string
 *                       link:
 *                         type: string
 *                       read:
 *                         type: boolean
 *                       relatedId:
 *                         type: integer
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 unreadCount:
 *                   type: integer
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno
 *   post:
 *     summary: Crear notificación
 *     description: Crea una nueva notificación para un usuario. Solo docentes y administradores.
 *     tags: [Notificaciones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, title]
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: ID del usuario destinatario
 *               type:
 *                 type: string
 *                 description: Tipo de notificación
 *               title:
 *                 type: string
 *                 description: Título de la notificación
 *               message:
 *                 type: string
 *                 description: Cuerpo del mensaje
 *               link:
 *                 type: string
 *                 description: Enlace opcional
 *               relatedId:
 *                 type: integer
 *                 description: ID del recurso relacionado
 *     responses:
 *       201:
 *         description: Notificación creada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 notificacion:
 *                   type: object
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Acción no permitida
 *       500:
 *         description: Error interno
 */
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { notificaciones } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const items = await db
      .select({
        id: notificaciones.id,
        type: notificaciones.type,
        title: notificaciones.title,
        message: notificaciones.message,
        link: notificaciones.link,
        read: notificaciones.read,
        relatedId: notificaciones.relatedId,
        createdAt: notificaciones.createdAt,
      })
      .from(notificaciones)
      .where(eq(notificaciones.userId, user.id))
      .orderBy(desc(notificaciones.createdAt))
      .limit(50);

    const [unreadResult] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(notificaciones)
      .where(and(eq(notificaciones.userId, user.id), eq(notificaciones.read, false)));

    return NextResponse.json({
      notificaciones: items,
      unreadCount: unreadResult?.count || 0,
    });
  } catch (error) {
    console.error("Error al cargar notificaciones:", error);
    return NextResponse.json({ error: "Error al cargar notificaciones" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { userId, type, title, message, link, relatedId } = body;

    if (!userId || !title) {
      return NextResponse.json({ error: "userId y title requeridos" }, { status: 400 });
    }

    const [created] = await db.insert(notificaciones).values({
      userId,
      type: type || "system",
      title,
      message: message || null,
      link: link || null,
      relatedId: relatedId || null,
    }).returning();

    return NextResponse.json({ notificacion: created }, { status: 201 });
  } catch (error) {
    console.error("Error al crear notificacion:", error);
    return NextResponse.json({ error: "Error al crear notificacion" }, { status: 500 });
  }
}
