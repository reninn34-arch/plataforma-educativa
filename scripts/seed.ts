import { config } from "dotenv";
import { join } from "path";
config({ path: join(process.cwd(), ".env.local") });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import * as schema from "../src/lib/db/schema";

async function seed() {
  const connectionString = process.env.DATABASE_URL!;
  const client = postgres(connectionString);
  const db = drizzle(client, { schema });

  console.log("🌱 Sembrando base de datos Atlas Edu...\n");

  await db.delete(schema.chatMessages);
  await db.delete(schema.chatSessions);
  await db.delete(schema.progress);
  await db.delete(schema.subjects);
  await db.delete(schema.users);
  console.log("🧹 Datos anteriores eliminados");

  const users = await db
    .insert(schema.users)
    .values([
      { cedula: "1723456789", pin: await bcrypt.hash("1234", 10), fullName: "Maria Elena Guaman", role: "student" },
      { cedula: "1700000001", pin: await bcrypt.hash("1234", 10), fullName: "Jose Luis Quishpe", role: "student" },
      { cedula: "1700000002", pin: await bcrypt.hash("1234", 10), fullName: "Ana Lucia Paredes", role: "student" },
      { cedula: "1799999999", pin: await bcrypt.hash("5678", 10), fullName: "Prof. Patricio Mena", role: "teacher" },
    ])
    .returning();
  console.log(`👤 ${users.length} usuarios creados: 3 estudiantes + 1 docente`);

  const subjects = await db
    .insert(schema.subjects)
    .values([
      { slug: "matematicas", name: "Matematicas", emoji: "🔢", color: "#3B82F6" },
      { slug: "lenguaje", name: "Lenguaje", emoji: "📖", color: "#10B981" },
      { slug: "ciencias", name: "Ciencias", emoji: "🔬", color: "#8B5CF6" },
      { slug: "sociales", name: "Sociales", emoji: "🌎", color: "#F59E0B" },
    ])
    .returning();
  console.log("📚 4 materias del tronco comun creadas");

  for (const user of users.filter((u) => u.role === "student")) {
    for (const subject of subjects) {
      await db.insert(schema.progress).values({
        userId: user.id,
        subjectId: subject.id,
        percentage: Math.floor(Math.random() * 80),
        consecutiveFailures: Math.floor(Math.random() * 4),
        daysInactive: Math.floor(Math.random() * 5),
      });
    }
  }
  console.log("📊 Progreso simulado creado para cada estudiante");

  console.log("\n✅ Seed completado!");
  console.log("\n🔑 Credenciales de prueba:");
  console.log("   Estudiante: 1723456789 / PIN: 1234");
  console.log("   Docente:    1799999999 / PIN: 5678\n");
}

seed()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
