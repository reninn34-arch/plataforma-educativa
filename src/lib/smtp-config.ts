import { db } from "@/lib/db";
import { configuracion } from "@/lib/db/schema";

export async function getSmtpConfig(): Promise<{
  host: string;
  port: number;
  user: string;
  pass: string;
  fromName: string;
} | null> {
  try {
    const rows = await db.select().from(configuracion);
    const map: Record<string, string> = {};
    for (const r of rows) { map[r.clave] = r.valor || ""; }

    const host = map.smtp_host || process.env.SMTP_HOST;
    if (!host) return null;

    return {
      host,
      port: parseInt(map.smtp_port || process.env.SMTP_PORT || "587"),
      user: map.smtp_user || process.env.SMTP_USER || "",
      pass: map.smtp_pass || process.env.SMTP_PASS || "",
      fromName: map.smtp_from_name || process.env.SMTP_FROM_NAME || "Atlas Edu",
    };
  } catch {
    const host = process.env.SMTP_HOST;
    if (!host) return null;
    return {
      host,
      port: parseInt(process.env.SMTP_PORT || "587"),
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
      fromName: process.env.SMTP_FROM_NAME || "Atlas Edu",
    };
  }
}
