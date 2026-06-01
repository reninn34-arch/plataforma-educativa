import { NextRequest, NextResponse } from "next/server";

/**
 * @swagger
 * /api/admin/config:
 *   get:
 *     summary: Obtener configuración SMTP
 *     description: Devuelve la configuración actual del servidor de correo SMTP (sin contraseña).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuración SMTP actual
 *       403:
 *         description: Solo administradores
 *   put:
 *     summary: Guardar configuración SMTP
 *     description: Actualiza la configuración del servidor de correo para envío de credenciales.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [smtp_host, smtp_user]
 *             properties:
 *               smtp_host: { type: string, example: "smtp.gmail.com" }
 *               smtp_port: { type: string, example: "587" }
 *               smtp_user: { type: string, example: "institucion@gmail.com" }
 *               smtp_pass: { type: string, description: "Contraseña de aplicación" }
 *               smtp_from_name: { type: string, example: "Atlas Edu" }
 *     responses:
 *       200:
 *         description: Configuración guardada
 *       403:
 *         description: Solo administradores
 */
import { db } from "@/lib/db";
import { configuracion } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

const SENSITIVE_KEYS = ["smtp_pass", "smtp_password"];

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  try {
    const rows = await db.select().from(configuracion);
    const result: Record<string, string> = {};
    for (const r of rows) {
      if (SENSITIVE_KEYS.includes(r.clave)) {
        result[r.clave] = r.valor ? "••••••••" : "";
      } else {
        result[r.clave] = r.valor || "";
      }
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Error al cargar configuracion" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  try {
    const body = await request.json();
    for (const [clave, valor] of Object.entries(body)) {
      if (typeof clave !== "string" || clave.length > 100) continue;
      if (SENSITIVE_KEYS.includes(clave) && valor === "••••••••") continue;

      const [exist] = await db.select({ id: configuracion.id }).from(configuracion).where(eq(configuracion.clave, clave)).limit(1);
      if (exist) {
        await db.update(configuracion).set({ valor: valor as string, updatedAt: new Date() }).where(eq(configuracion.id, exist.id));
      } else {
        await db.insert(configuracion).values({ clave, valor: valor as string });
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Error al guardar configuracion" }, { status: 500 });
  }
}
