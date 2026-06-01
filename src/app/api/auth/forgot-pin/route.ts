import { NextRequest, NextResponse } from "next/server";

/**
 * @swagger
 * /api/auth/forgot-pin:
 *   post:
 *     summary: Solicitar recuperación de PIN
 *     description: Envía un correo con enlace para restablecer el PIN de acceso.
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cedula]
 *             properties:
 *               cedula:
 *                 type: string
 *                 description: Cédula de identidad (10 dígitos)
 *                 example: "0102030405"
 *     responses:
 *       200:
 *         description: Si la cédula existe, se envía correo con enlace de recuperación
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *       400:
 *         description: Cuenta desactivada o sin correo registrado
 *       429:
 *         description: Rate limit (máx 3 solicitudes por minuto)
 */
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createToken } from "@/lib/auth";
import { getSmtpConfig } from "@/lib/smtp-config";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rl = rateLimit({ key: `forgot-pin:${ip}`, maxRequests: 3, windowMs: 60_000 });
    if (rl) return rl;

    const { cedula } = await request.json();
    if (!cedula || cedula.length !== 10) {
      return NextResponse.json({ error: "Cedula invalida" }, { status: 400 });
    }

    const [user] = await db
      .select({ id: users.id, cedula: users.cedula, email: users.email, fullName: users.fullName, activo: users.activo })
      .from(users)
      .where(eq(users.cedula, cedula))
      .limit(1);

    if (!user) {
      return NextResponse.json({ message: "Si la cedula existe, recibiras un correo con instrucciones." });
    }

    if (!user.activo) {
      return NextResponse.json({ error: "Esta cuenta esta desactivada. Contacta al administrador." }, { status: 400 });
    }

    if (!user.email) {
      return NextResponse.json({
        error: "No tienes un correo registrado. Contacta al administrador para recuperar tu acceso.",
      }, { status: 400 });
    }

    const resetToken = await createToken(
      { id: user.id, cedula: user.cedula, fullName: user.fullName, role: "" as any },
      "15m"
    );

    const smtpConfig = await getSmtpConfig();
    if (!smtpConfig) {
      return NextResponse.json({
        message: "Si la cedula existe, recibiras un correo con instrucciones.",
      });
    }

    const baseUrl = request.nextUrl.origin;
    const resetUrl = `${baseUrl}/recuperar-pin?token=${resetToken}`;

    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.port === 465,
      auth: { user: smtpConfig.user, pass: smtpConfig.pass },
    });

    await transporter.sendMail({
      from: `${smtpConfig.fromName} <${smtpConfig.user}>`,
      to: user.email,
      subject: "Recuperacion de PIN - Atlas Edu",
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">
          <h2 style="color:#1a2332;">Atlas Edu - Recuperacion de PIN</h2>
          <p>Hola <strong>${user.fullName}</strong>,</p>
          <p>Has solicitado restablecer tu PIN de acceso.</p>
          <p>Haz clic en el siguiente boton para crear un nuevo PIN:</p>
          <div style="margin:24px 0;">
            <a href="${resetUrl}" style="background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">
              Restablecer mi PIN
            </a>
          </div>
          <p style="color:#64748b;font-size:12px;">Este enlace expira en 15 minutos. Si no solicitaste este cambio, ignora este mensaje.</p>
        </div>
      `,
    });

    return NextResponse.json({ message: "Si la cedula existe, recibiras un correo con instrucciones." });
  } catch (error) {
    console.error("Forgot PIN error:", error);
    return NextResponse.json({ error: "Error al procesar la solicitud" }, { status: 500 });
  }
}
