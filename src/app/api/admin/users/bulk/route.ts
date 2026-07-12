/**
 * @swagger
 * /api/admin/users/bulk:
 *   post:
 *     summary: Importar usuarios masivamente
 *     description: Carga un archivo CSV con estudiantes y los crea en lote. Reactiva usuarios inactivos existentes y omite duplicados activos.
 *     tags: [Administración]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Archivo CSV con columnas Cédula, Nombre Completo y opcional Correo
 *     responses:
 *       200:
 *         description: Resultado de la importación con detalle por fila
 *       400:
 *         description: Archivo inválido o formato incorrecto
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Solo administradores
 *       500:
 *         description: Error interno
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { parseCSV, generatePin } from "@/lib/csv-utils";
import { hashPin } from "@/lib/hash-utils";
import type { InferInsertModel } from "drizzle-orm";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_DATA_ROWS = 500;
const MAX_NAME_LENGTH = 200;
const MAX_EMAIL_LENGTH = 200;

type NewUser = InferInsertModel<typeof users>;

interface BulkResult {
  cedula: string;
  nombre: string;
  pin: string;
  status: "creado" | "reactivado" | "omitido" | "error";
  razon?: string;
}

interface ReactivationItem {
  id: number;
  nombre: string;
  email: string | null;
  hashed: string;
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const admin = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!admin || admin.role !== "admin") {
    return NextResponse.json({ error: "Solo admin" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se recibio ningun archivo" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "El archivo es demasiado grande. Maximo 5MB." }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length < 2) {
      return NextResponse.json({ error: "El archivo debe tener al menos una fila de datos ademas de la cabecera" }, { status: 400 });
    }

    const dataRowsCount = rows.length - 1;
    if (dataRowsCount > MAX_DATA_ROWS) {
      return NextResponse.json({ error: `El archivo excede el limite de ${MAX_DATA_ROWS} filas de datos.` }, { status: 400 });
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

    const allCedulas: string[] = [];
    const rowsData: { cedula: string; nombre: string; email: string | null; error?: string }[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const cedula = (row[cedulaIdx] || "").replace(/\D/g, "").slice(0, 10);
      const nombre = (row[nombreIdx] || "").trim();
      const email = emailIdx !== -1 ? (row[emailIdx] || "").trim() || null : null;

      let error: string | undefined;
      if (!cedula || cedula.length !== 10) error = "Cedula invalida";
      else if (!nombre) error = "Nombre requerido";
      else if (nombre.length > MAX_NAME_LENGTH) error = "Nombre excede 200 caracteres";
      else if (email && email.length > MAX_EMAIL_LENGTH) error = "Email excede 200 caracteres";

      if (error) {
        rowsData.push({ cedula, nombre, email, error });
      } else {
        allCedulas.push(cedula);
        rowsData.push({ cedula, nombre, email });
      }
    }

    const existingUsers = allCedulas.length > 0 ? await db
      .select({ id: users.id, cedula: users.cedula, activo: users.activo })
      .from(users)
      .where(inArray(users.cedula, allCedulas)) : [];
    const existingByCedula = new Map(existingUsers.map(u => [u.cedula, u]));

    const pins = rowsData.filter(r => !r.error).map(() => generatePin());
    const hashedPins = await Promise.all(pins.map(p => hashPin(p)));

    const toInsert: NewUser[] = [];
    const toReactivate: ReactivationItem[] = [];
    const resultados: BulkResult[] = [];
    let creados = 0, omitidos = 0, reactivados = 0, errores = 0;

    let pinIndex = 0;
    for (const row of rowsData) {
      const { cedula, nombre, email } = row;

      if (row.error) {
        resultados.push({ cedula, nombre, pin: "", status: "error", razon: row.error });
        errores++;
        continue;
      }

      const pin = pins[pinIndex];
      const hashed = hashedPins[pinIndex];
      pinIndex++;
      const existing = existingByCedula.get(cedula);

      if (existing) {
        if (!existing.activo) {
          toReactivate.push({ id: existing.id, nombre, email, hashed });
          resultados.push({ cedula, nombre, pin, status: "reactivado" });
          reactivados++;
        } else {
          resultados.push({ cedula, nombre, pin: "", status: "omitido", razon: "Ya existe" });
          omitidos++;
        }
      } else {
        toInsert.push({
          cedula,
          fullName: nombre,
          role: "student",
          email: email || null,
          pin: hashed,
        });
        resultados.push({ cedula, nombre, pin, status: "creado" });
        creados++;
      }
    }

    await db.transaction(async (tx) => {
      if (toInsert.length > 0) {
        await tx.insert(users).values(toInsert);
      }
      for (const r of toReactivate) {
        await tx.update(users)
          .set({ activo: true, fullName: r.nombre, role: "student", email: r.email || null, pin: r.hashed, pinUpdatedAt: sql`now()` })
          .where(eq(users.id, r.id));
      }
    });

    const total = creados + omitidos + reactivados + errores;

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
