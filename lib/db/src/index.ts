import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

export type Db = NodePgDatabase<typeof schema>;

let pool: pg.Pool | null = null;
let dbInstance: Db | null = null;

/** True when DATABASE_URL is set (Neon / Postgres path). */
export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

/**
 * Lazy Postgres client. Safe to import without DATABASE_URL.
 * Throws only when first used without a URL.
 */
export function getDb(): Db {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL must be set to use the database");
  }
  if (!dbInstance) {
    pool = new Pool({ connectionString: url });
    dbInstance = drizzle(pool, { schema });
  }
  return dbInstance;
}

export function getPool(): pg.Pool {
  getDb();
  if (!pool) throw new Error("DATABASE_URL must be set to use the database");
  return pool;
}

export * from "./schema";
