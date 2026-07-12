/**
 * @swagger
 * /api/admin/credentials/email:
 *   post:
 *     summary: Enviar credenciales por correo a un curso
 *     description: Envía las credenciales de acceso por correo electrónico a todos los estudiantes de un curso. Opcionalmente reinicia los PINs.
 *     tags: [Administración]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cursoId]
 *             properties:
 *               cursoId: { type: integer }
 *               resetPins: { type: boolean, description: "Si es true, genera nuevos PINs antes de enviar" }
 *     responses:
 *       200:
 *         description: Correos enviados
 *       400:
 *         description: cursoId requerido, SMTP no configurado o sin estudiantes con correo
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       404:
 *         description: Curso no encontrado
 *       500:
 *         description: Error interno
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cursoEstudiantes, users, cursos } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { hashPin } from "@/lib/hash-utils";
import { getSmtpConfig } from "@/lib/smtp-config";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  try {
    const { cursoId, resetPins } = await request.json();
    if (!cursoId) return NextResponse.json({ error: "cursoId requerido" }, { status: 400 });

    const smtpConfig = await getSmtpConfig();
    if (!smtpConfig) {
      return NextResponse.json({ error: "SMTP no configurado. Ve a Configuracion para configurarlo." }, { status: 400 });
    }

    const [curso] = await db.select({ nombre: cursos.nombre, nivel: cursos.nivel }).from(cursos).where(eq(cursos.id, cursoId)).limit(1);
    if (!curso) return NextResponse.json({ error: "Curso no encontrado" }, { status: 404 });

    const enrolled = await db
      .select({ id: users.id, cedula: users.cedula, fullName: users.fullName, email: users.email })
      .from(cursoEstudiantes)
      .leftJoin(users, eq(cursoEstudiantes.estudianteId, users.id))
      .where(eq(cursoEstudiantes.cursoId, cursoId));

    const studentsWithEmail = enrolled.filter(s => s.email && s.id);
    if (studentsWithEmail.length === 0) {
      return NextResponse.json({ error: "Ningun estudiante tiene correo registrado" }, { status: 400 });
    }

    const pinsByStudent: Record<number, string> = {};

    if (resetPins) {
      const updates = studentsWithEmail.map(s => ({
        id: s.id!,
        pin: String(Math.floor(1000 + Math.random() * 9000)),
      }));

      // Hash all pins concurrently
      const hashedPins = await Promise.all(updates.map(u => hashPin(u.pin)));

      // Update all users concurrently
      await Promise.all(updates.map((u, i) =>
        db.update(users).set({ pin: hashedPins[i], pinUpdatedAt: sql`now()` }).where(eq(users.id, u.id))
      ));

      for (const u of updates) {
        pinsByStudent[u.id] = u.pin;
      }
    }

    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.port === 465,
      auth: { user: smtpConfig.user, pass: smtpConfig.pass },
    });

    const from = `${smtpConfig.fromName} <${smtpConfig.user}>`;
    let sent = 0;

    for (const s of studentsWithEmail) {
      if (!s.email) continue;
      const pin = resetPins ? pinsByStudent[s.id!] : null;
      try {
        await transporter.sendMail({
          from,
          to: s.email,
          subject: `Credenciales Atlas Edu - ${curso.nombre}`,
          html: `
            <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">
              <h2 style="color:#1a2332;">Atlas Edu - Credenciales de Acceso</h2>
              <p>Hola <strong>${s.fullName}</strong>,</p>
              <p>Has sido registrado en el curso <strong>${curso.nombre} (${curso.nivel})</strong>.</p>
              <div style="background:#f0f4f8;padding:16px;border-radius:8px;margin:16px 0;">
                <p><strong>Usuario (Cedula):</strong> ${s.cedula}</p>
                ${pin ? `<p><strong>PIN:</strong> <span style="font-size:18px;letter-spacing:4px;">${pin}</span></p>` : `<p><strong>PIN:</strong> Entregado por el administrador.</p>`}
              </div>
              <p>Accede en la plataforma con tu cedula y PIN.</p>
              <p style="color:#64748b;font-size:12px;">Estas credenciales son personales. No las compartas.</p>
            </div>
          `,
        });
        sent++;
      } catch (err) {
        console.error(`Failed to send to ${s.email}:`, err);
      }
    }

    return NextResponse.json({ success: true, sent, total: studentsWithEmail.length, pinsReset: !!resetPins });
  } catch (error) {
    console.error("Email send error:", error);
    return NextResponse.json({ error: "Error al enviar correos" }, { status: 500 });
  }
}
