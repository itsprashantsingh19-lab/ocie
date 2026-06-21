import { Pool } from "pg";

/**
 * Single shared connection pool, host-agnostic. Works with Supabase Postgres,
 * Neon, or Vercel Postgres — whichever DATABASE_URL points at. Most managed
 * Postgres providers require SSL; the conditional below enables it unless
 * you're pointed at a local DB (localhost connection strings skip it).
 */
declare global {
  var __ociePgPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and add your Postgres connection string."
    );
  }
  const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");
  return new Pool({
    connectionString,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
  });
}

export function getPool(): Pool {
  if (!global.__ociePgPool) {
    global.__ociePgPool = createPool();
  }
  return global.__ociePgPool;
}
