import { execSync } from "child_process";
import { join } from "path";
import { config } from "dotenv";

config({ path: join(process.cwd(), ".env.local") });

console.log("🔧 Atlas Edu - Setup de Base de Datos\n");

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("❌ DATABASE_URL no esta configurada en .env.local");
  console.error("   Ejemplo: postgresql://usuario:password@localhost:5432/atlas_edu");
  process.exit(1);
}

console.log(`📡 Conectando a: ${dbUrl.replace(/\/\/.*@/, "//****:****@")}`);

try {
  console.log("\n📦 Aplicando schema (drizzle-kit push)...");
  execSync("npx drizzle-kit push", { stdio: "inherit", cwd: process.cwd() });

  console.log("\n🌱 Ejecutando seed...");
  execSync("npx tsx scripts/seed.ts", { stdio: "inherit", cwd: process.cwd() });

  console.log("\n✅ Setup completado! Corre 'npm run dev' para iniciar.");
} catch (error) {
  console.error("\n❌ Error durante el setup:", error instanceof Error ? error.message : error);
  process.exit(1);
}
