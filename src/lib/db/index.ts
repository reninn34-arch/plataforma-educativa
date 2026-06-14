import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/lib/env";

const connectionString = getEnv().DATABASE_URL;

const client = postgres(connectionString, {
  max: 100,
  idle_timeout: 5,
  connect_timeout: 10,
  prepare: false,
  connection: {
    statement_timeout: 10000,
    idle_in_transaction_session_timeout: 30000,
  },
});

export const db = drizzle(client);
