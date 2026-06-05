import { db } from "../src/lib/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Applying notificaciones migration...");
  
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS "notificaciones" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer NOT NULL,
      "type" varchar(20) DEFAULT 'system' NOT NULL,
      "title" varchar(200) NOT NULL,
      "message" text,
      "link" varchar(500),
      "read" boolean DEFAULT false NOT NULL,
      "related_id" integer,
      "created_at" timestamp DEFAULT now() NOT NULL
    );
  `));

  await db.execute(sql.raw(`
    CREATE INDEX IF NOT EXISTS "idx_notificaciones_user_id" ON "notificaciones" ("user_id");
  `));

  await db.execute(sql.raw(`
    CREATE INDEX IF NOT EXISTS "idx_notificaciones_read" ON "notificaciones" ("read");
  `));

  await db.execute(sql.raw(`
    CREATE INDEX IF NOT EXISTS "idx_notificaciones_user_read" ON "notificaciones" ("user_id","read");
  `));

  console.log("Migration applied successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
