const { config } = require("dotenv");
config({ path: ".env.local" });

const postgres = require("postgres");

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) throw new Error("DATABASE_URL not found");

  const sql = postgres(DATABASE_URL, { max: 1 });

  await sql.unsafe(`
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
  `);

  await sql.unsafe(`CREATE INDEX IF NOT EXISTS "idx_notificaciones_user_id" ON "notificaciones" ("user_id")`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS "idx_notificaciones_read" ON "notificaciones" ("read")`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS "idx_notificaciones_user_read" ON "notificaciones" ("user_id","read")`);

  console.log("Migration applied successfully!");
  await sql.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
