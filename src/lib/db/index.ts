import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/lib/env";

const connectionString = getEnv().DATABASE_URL;

const isProduction = getEnv().NODE_ENV === "production";

const client = postgres(connectionString, {
  max: isProduction ? 3 : 100,
  idle_timeout: isProduction ? 20 : 5,
  connect_timeout: 10,
  prepare: false,
  ssl: isProduction ? "require" : false,
  max_lifetime: isProduction ? 60 : undefined,
  connection: {
    statement_timeout: 10000,
    idle_in_transaction_session_timeout: 30000,
  },
});

export const db = drizzle(client);