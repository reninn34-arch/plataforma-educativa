import { config } from "dotenv";
import { join } from "path";
config({ path: join(process.cwd(), ".env.local") });

import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import * as schema from "../src/lib/db/schema";

async function seed() {
  const connectionString = process.env.DATABASE_URL!;
  const client = postgres(connectionString);
  const db = drizzle(client, { schema });

  console.log("🌱 Sembrando base de datos Atlas Edu...\n");

  // Delete in dependency order (children first)
  // Truncate all tables in dependency order using CASCADE
  await db.execute(sql`TRUNCATE TABLE
    submission_answers,
    assignment_questions,
    direct_messages,
    assignment_submissions,
    assignments,
    practice_answers,
    practice_sessions,
    student_exercises,
    student_modules,
    asistencia,
    curso_estudiantes,
    curso_profesores,
    cursos,
    chat_messages,
    chat_sessions,
    progress,
    user_progress,
    nodes,
    modules,
    subjects,
    users
  RESTART IDENTITY CASCADE`);
  console.log("🧹 Datos anteriores eliminados");

  const users = await db
    .insert(schema.users)
    .values([
      { cedula: "1723456789", pin: await bcrypt.hash("1234", 10), fullName: "Maria Elena Guaman", role: "student" },
      { cedula: "1700000001", pin: await bcrypt.hash("1234", 10), fullName: "Jose Luis Quishpe", role: "student" },
      { cedula: "1700000002", pin: await bcrypt.hash("1234", 10), fullName: "Ana Lucia Paredes", role: "student" },
      { cedula: "1799999999", pin: await bcrypt.hash("5678", 10), fullName: "Prof. Patricio Mena", role: "teacher" },
      { cedula: "1700000000", pin: await bcrypt.hash("0000", 10), fullName: "Administrador", role: "admin" as any },
    ])
    .returning();
  console.log("👤 5 usuarios creados: 3 estudiantes + 1 docente + 1 admin");

  const subjects = await db
    .insert(schema.subjects)
    .values([
      { slug: "matematicas", name: "Matemáticas", emoji: "🔢", color: "#3B82F6" },
      { slug: "fisica", name: "Física", emoji: "⚡", color: "#10B981" },
      { slug: "ingles", name: "Inglés", emoji: "🗣", color: "#8B5CF6" },
      { slug: "quimica", name: "Química", emoji: "🧪", color: "#F59E0B" },
    ])
    .returning();
  console.log("📚 4 materias creadas");

  console.log("\n✅ Seed completado!");
  console.log("\n🔑 Credenciales de prueba:");
  console.log("   Admin:      1700000000 / PIN: 0000");
  console.log("   Estudiante: 1723456789 / PIN: 1234");
  console.log("   Docente:    1799999999 / PIN: 5678\n");
}

seed()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
