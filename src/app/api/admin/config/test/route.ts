import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getSmtpConfig } from "@/lib/smtp-config";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
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
