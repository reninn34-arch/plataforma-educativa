/**
 * @swagger
 * /api/admin/config/test:
 *   post:
 *     summary: Probar configuración SMTP
 *     description: Envía un correo de prueba utilizando la configuración SMTP proporcionada para verificar que funciona.
 *     tags: [Administración]
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
 *               smtp_host: { type: string }
 *               smtp_port: { type: string }
 *               smtp_user: { type: string }
 *               smtp_pass: { type: string }
 *               smtp_from_name: { type: string }
 *     responses:
 *       200:
 *         description: Correo de prueba enviado exitosamente
 *       400:
 *         description: Error al enviar el correo
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       500:
 *         description: Error interno
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { getSmtpConfig } from "@/lib/smtp-config";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  try {
    const body = await request.json();
    const nodemailer = await import("nodemailer");

    const transporter = nodemailer.default.createTransport({
      host: body.smtp_host,
      port: parseInt(body.smtp_port || "587"),
      secure: body.smtp_port === "465",
      auth: {
        user: body.smtp_user,
        pass: body.smtp_pass,
      },
    });

    const from = `${body.smtp_from_name || "Atlas Edu"} <${body.smtp_user}>`;

    await transporter.sendMail({
      from,
      to: body.smtp_user,
      subject: "Atlas Edu - Correo de prueba",
      html: `<div style="font-family:sans-serif;padding:20px;"><h2>Configuracion SMTP exitosa</h2><p>Si puedes leer este correo, la configuracion SMTP de Atlas Edu esta funcionando correctamente.</p></div>`,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("SMTP test error:", error);
    return NextResponse.json({ error: error.message || "Error al enviar correo de prueba" }, { status: 400 });
  }
}
