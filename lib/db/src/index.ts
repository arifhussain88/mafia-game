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
    // Neon drops idle connections when its compute suspends. Without a listener,
    // pg emits an unhandled 'error' on the pool and Node exits, wiping every
    // in-memory game. The pool replaces the dead client on next use.
    pool.on("error", (err) => {
      console.error("[db] idle client error:", err.message);
    });
    dbInstance = drizzle(pool, { schema });
  }
  return dbInstance;
}

/**
 * Idempotent schema upgrades, run once at server start. The deploy never runs
 * drizzle-kit, so every column/table added after the first push is created
 * here with IF NOT EXISTS; safe to run on every boot.
 */
export async function ensureSchema(): Promise<void> {
  if (!hasDatabaseUrl()) return;
  const p = getPool();
  await p.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at timestamptz;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason text;
    CREATE TABLE IF NOT EXISTS reports (
      id text PRIMARY KEY,
      reporter_id text,
      reporter_name text NOT NULL,
      reported_id text,
      reported_name text NOT NULL,
      room_code text NOT NULL,
      reason text NOT NULL,
      message text,
      status text NOT NULL DEFAULT 'open',
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS reports_created_at_idx ON reports (created_at);
    ALTER TABLE match_players ADD COLUMN IF NOT EXISTS outcome text;
    ALTER TABLE match_players ADD COLUMN IF NOT EXISTS saves integer NOT NULL DEFAULT 0;
    ALTER TABLE match_players ADD COLUMN IF NOT EXISTS mafia_found integer NOT NULL DEFAULT 0;
    ALTER TABLE match_players ADD COLUMN IF NOT EXISTS kills integer NOT NULL DEFAULT 0;
    CREATE INDEX IF NOT EXISTS match_players_user_idx ON match_players (user_id);
  `);
}

export function getPool(): pg.Pool {
  getDb();
  if (!pool) throw new Error("DATABASE_URL must be set to use the database");
  return pool;
}

export * from "./schema";
