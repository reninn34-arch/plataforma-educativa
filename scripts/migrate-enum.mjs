import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL);

try {
  await sql.unsafe(`ALTER TYPE "public"."question_type" ADD VALUE 'completar'`);
  console.log("OK: Added completar to enum");
} catch (e) {
  console.log("Note:", e.message.slice(0, 120));
}
process.exit(0);
