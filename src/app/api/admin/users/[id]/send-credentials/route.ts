import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { hashPin } from "@/lib/hash-utils";
import { getSmtpConfig } from "@/lib/smtp-config";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const admin = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!admin || admin.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  try {
    const { id } = await params;
    const userId = parseInt(id);

    const [user] = await db.select({
      id: users.id,
      cedula: users.cedula,
      fullName: users.fullName,
      email: users.email,
      whatsapp: users.whatsapp,
    }).from(users).where(eq(users.id, userId));

    if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    if (!user.email) return NextResponse.json({ error: "El usuario no tiene correo registrado" }, { status: 400 });

    const smtpConfig = await getSmtpConfig();
    if (!smtpConfig) {
      return NextResponse.json({ error: "SMTP no configurado. Ve a Configuracion para configurarlo." }, { status: 400 });
    }

    const pin = String(Math.floor(1000 + Math.random() * 9000));
    const hashed = await hashPin(pin);
    await db.update(users).set({ pin: hashed, pinUpdatedAt: sql`now()` }).where(eq(users.id, userId));

    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.port === 465,
      auth: { user: smtpConfig.user, pass: smtpConfig.pass },
    });

    const whatsappLine = user.whatsapp
      ? `<p><strong>WhatsApp:</strong> <a href="https://wa.me/${user.whatsapp}" style="color:#2563eb;">+${user.whatsapp}</a></p>`
      : "";

    await transporter.sendMail({
      from: `${smtpConfig.fromName} <${smtpConfig.user}>`,
      to: user.email,
      subject: `Credenciales Atlas Edu - ${user.fullName}`,
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">
          <h2 style="color:#1a2332;">Atlas Edu - Credenciales de Acceso</h2>
          <p>Hola <strong>${user.fullName}</strong>,</p>
          <div style="background:#f0f4f8;padding:16px;border-radius:8px;margin:16px 0;">
            <p><strong>Usuario (Cedula):</strong> ${user.cedula}</p>
            <p><strong>PIN:</strong> <span style="font-size:18px;letter-spacing:4px;">${pin}</span></p>
            ${whatsappLine}
          </div>
          <p>Accede en la plataforma con tu cédula y PIN.</p>
          <p style="color:#64748b;font-size:12px;">Estas credenciales son personales. No las compartas.</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, emailSent: true, pinReset: true });
  } catch (error) {
    console.error("Send credentials error:", error);
    return NextResponse.json({ error: "Error al enviar credenciales" }, { status: 500 });
  }
}
