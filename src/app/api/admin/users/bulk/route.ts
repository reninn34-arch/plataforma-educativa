import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === "," || ch === ";") {
        current.push(cell.trim());
        cell = "";
      } else if (ch === "\n") {
        current.push(cell.trim());
        if (current.some(c => c !== "")) {
          rows.push(current);
        }
        current = [];
        cell = "";
      } else if (ch === "\r") {
        continue;
      } else {
        cell += ch;
      }
    }
  }
  if (cell) current.push(cell.trim());
  if (current.some(c => c !== "")) rows.push(current);

  return rows;
}

interface BulkResult {
  cedula: string;
  nombre: string;
  pin: string;
  status: "creado" | "reactivado" | "omitido" | "error";
  razon?: string;
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const admin = token ? await verifyToken(token) : null;
  if (!admin || admin.role !== "admin") {
    return NextResponse.json({ error: "Solo admin" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se recibio ningun archivo" }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length < 2) {
      return NextResponse.json({ error: "El archivo debe tener al menos una fila de datos ademas de la cabecera" }, { status: 400 });
    }

    const header = rows[0].map(h => h.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""));
    const cedulaIdx = header.findIndex(h => h.includes("cedula") || h === "id" || h === "dni");
    const nombreIdx = header.findIndex(h => h.includes("nombre") || h === "name" || h.includes("apellido"));
    const emailIdx = header.findIndex(h => h.includes("correo") || h.includes("email") || h === "mail");

    if (cedulaIdx === -1 || nombreIdx === -1) {
      return NextResponse.json({
        error: "El CSV debe tener columnas 'Cedula' y 'Nombre Completo'. Encabezados detectados: " + rows[0].join(", "),
      }, { status: 400 });
    }

    const resultados: BulkResult[] = [];
    let creados = 0;
    let omitidos = 0;
    let errores = 0;
    let reactivados = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const cedula = (row[cedulaIdx] || "").replace(/\D/g, "").slice(0, 10);
      const nombre = (row[nombreIdx] || "").trim();
      const email = emailIdx !== -1 ? (row[emailIdx] || "").trim() || null : null;

      if (!cedula || cedula.length !== 10) {
        resultados.push({ cedula: row[cedulaIdx] || "", nombre, pin: "", status: "error", razon: "Cedula invalida (debe tener 10 digitos)" });
        errores++;
        continue;
      }

      if (!nombre) {
        resultados.push({ cedula, nombre: "", pin: "", status: "error", razon: "Nombre vacio" });
        errores++;
        continue;
      }

      try {
        const [existing] = await db
          .select({ id: users.id, activo: users.activo })
          .from(users)
          .where(eq(users.cedula, cedula))
          .limit(1);

        const pin = generatePin();
        const hashed = await bcrypt.hash(pin, 10);

        if (existing) {
          if (!existing.activo) {
            await db.update(users).set({
              activo: true,
              fullName: nombre,
              role: "student" as any,
              email: email || null,
              pin: hashed,
            }).where(eq(users.id, existing.id));
            resultados.push({ cedula, nombre, pin, status: "reactivado" });
            reactivados++;
          } else {
            resultados.push({ cedula, nombre, pin: "", status: "omitido", razon: "Ya existe" });
            omitidos++;
          }
        } else {
          await db.insert(users).values({
            cedula,
            fullName: nombre,
            role: "student" as any,
            email: email || null,
            pin: hashed,
          });
          resultados.push({ cedula, nombre, pin, status: "creado" });
          creados++;
        }
      } catch (err: any) {
        resultados.push({ cedula, nombre, pin: "", status: "error", razon: err?.message || "Error de base de datos" });
        errores++;
      }
    }

    const total = creados + omitidos + errores + reactivados;

    return NextResponse.json({
      total,
      creados,
      reactivados,
      omitidos,
      errores,
      resultados,
    });
  } catch (error) {
    console.error("Bulk import error:", error);
    return NextResponse.json({ error: "Error al procesar el archivo" }, { status: 500 });
  }
}
