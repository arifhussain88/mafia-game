import fs from "fs";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { and, count, eq, gt, sql } from "drizzle-orm";
import {
  getDb,
  hasDatabaseUrl,
  profilesTable,
  sessionsTable,
  usersTable,
  type User,
} from "@workspace/db";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const BCRYPT_ROUNDS = 10;

export class DbUnavailableError extends Error {
  constructor(message = "Database temporarily unavailable") {
    super(message);
    this.name = "DbUnavailableError";
  }
}

export type StoredUser = {
  id: string;
  name: string;
  email: string;
  dob?: string;
  passwordHash: string;
  createdAt: string;
};

export type UserStore = {
  users: StoredUser[];
  sessions: Record<string, { userId: string; createdAt: string }>;
};

export function usingDatabase() {
  return hasDatabaseUrl();
}

function defaultUsersFile() {
  return path.resolve(import.meta.dirname, "..", "data", "users.json");
}

export function getUsersFile() {
  return process.env.USERS_FILE || defaultUsersFile();
}

function ensureData() {
  const usersFile = getUsersFile();
  const dataDir = path.dirname(usersFile);
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(usersFile)) {
      fs.writeFileSync(usersFile, JSON.stringify({ users: [], sessions: {} }, null, 2));
    }
  } catch {
    // ignore
  }
}

export function readStore(): UserStore {
  ensureData();
  try {
    const raw = fs.readFileSync(getUsersFile(), "utf8");
    return JSON.parse(raw) as UserStore;
  } catch {
    return { users: [], sessions: {} };
  }
}

export function writeStore(store: UserStore) {
  ensureData();
  fs.writeFileSync(getUsersFile(), JSON.stringify(store, null, 2));
}

function isLegacySha256(hash: string) {
  return /^[a-f0-9]{64}$/i.test(hash);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string) {
  if (isLegacySha256(passwordHash)) {
    const legacy = crypto.createHash("sha256").update(password).digest("hex");
    return legacy === passwordHash;
  }
  return bcrypt.compare(password, passwordHash);
}

function rowToStoredUser(row: User): StoredUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    dob: row.dob ?? undefined,
    passwordHash: row.passwordHash,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}

function createSessionJson(store: UserStore, userId: string) {
  const token = crypto.randomUUID();
  store.sessions[token] = { userId, createdAt: new Date().toISOString() };
  return token;
}

async function createSessionDb(userId: string) {
  const token = crypto.randomUUID();
  try {
    const db = getDb();
    await db.insert(sessionsTable).values({
      token,
      userId,
      createdAt: new Date(),
    });
    return token;
  } catch (err) {
    throw new DbUnavailableError(err instanceof Error ? err.message : "Database unavailable");
  }
}

/** @deprecated Prefer createAuthSession — kept for JSON-only callers during transition. */
export function createSession(store: UserStore, userId: string) {
  return createSessionJson(store, userId);
}

export async function createAuthSession(userId: string): Promise<string> {
  if (!usingDatabase()) {
    const store = readStore();
    const token = createSessionJson(store, userId);
    writeStore(store);
    return token;
  }
  return createSessionDb(userId);
}

export async function getUserForToken(token: string | null | undefined): Promise<StoredUser | null> {
  if (!token) return null;

  if (!usingDatabase()) {
    const store = readStore();
    const session = store.sessions[token];
    if (!session) return null;
    const created = Date.parse(session.createdAt);
    if (!Number.isNaN(created) && Date.now() - created > SESSION_TTL_MS) {
      delete store.sessions[token];
      writeStore(store);
      return null;
    }
    const user = store.users.find((u) => u.id === session.userId);
    return user ?? null;
  }

  try {
    const db = getDb();
    const cutoff = new Date(Date.now() - SESSION_TTL_MS);
    const rows = await db
      .select({
        user: usersTable,
        sessionCreatedAt: sessionsTable.createdAt,
      })
      .from(sessionsTable)
      .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
      .where(and(eq(sessionsTable.token, token), gt(sessionsTable.createdAt, cutoff)))
      .limit(1);

    if (rows.length === 0) {
      await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
      return null;
    }
    return rowToStoredUser(rows[0].user);
  } catch (err) {
    throw new DbUnavailableError(err instanceof Error ? err.message : "Database unavailable");
  }
}

export async function deleteSession(token: string | null | undefined) {
  if (!token) return;

  if (!usingDatabase()) {
    const store = readStore();
    if (store.sessions[token]) {
      delete store.sessions[token];
      writeStore(store);
    }
    return;
  }

  try {
    const db = getDb();
    await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
  } catch (err) {
    throw new DbUnavailableError(err instanceof Error ? err.message : "Database unavailable");
  }
}

export async function countUsers(): Promise<number> {
  if (!usingDatabase()) {
    return readStore().users.length;
  }
  try {
    const db = getDb();
    const rows = await db.select({ n: count() }).from(usersTable);
    return Number(rows[0]?.n ?? 0);
  } catch (err) {
    throw new DbUnavailableError(err instanceof Error ? err.message : "Database unavailable");
  }
}

export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  const normalized = email.toLowerCase();
  if (!usingDatabase()) {
    return readStore().users.find((u) => u.email.toLowerCase() === normalized) ?? null;
  }
  try {
    const db = getDb();
    const rows = await db.select().from(usersTable).where(eq(usersTable.email, normalized)).limit(1);
    return rows[0] ? rowToStoredUser(rows[0]) : null;
  } catch (err) {
    throw new DbUnavailableError(err instanceof Error ? err.message : "Database unavailable");
  }
}

export async function createUser(input: {
  id: string;
  name: string;
  email: string;
  dob?: string;
  passwordHash: string;
  createdAt: string;
}): Promise<StoredUser> {
  if (!usingDatabase()) {
    const store = readStore();
    const user: StoredUser = {
      id: input.id,
      name: input.name,
      email: input.email,
      dob: input.dob,
      passwordHash: input.passwordHash,
      createdAt: input.createdAt,
    };
    store.users.push(user);
    writeStore(store);
    return user;
  }

  try {
    const db = getDb();
    const createdAt = new Date(input.createdAt);
    await db.insert(usersTable).values({
      id: input.id,
      name: input.name,
      email: input.email,
      dob: input.dob ?? null,
      passwordHash: input.passwordHash,
      createdAt,
    });
    await db.insert(profilesTable).values({
      userId: input.id,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      updatedAt: createdAt,
    });
    return {
      id: input.id,
      name: input.name,
      email: input.email,
      dob: input.dob,
      passwordHash: input.passwordHash,
      createdAt: input.createdAt,
    };
  } catch (err) {
    throw new DbUnavailableError(err instanceof Error ? err.message : "Database unavailable");
  }
}

export async function updatePasswordHash(userId: string, passwordHash: string) {
  if (!usingDatabase()) {
    const store = readStore();
    const user = store.users.find((u) => u.id === userId);
    if (user) {
      user.passwordHash = passwordHash;
      writeStore(store);
    }
    return;
  }
  try {
    const db = getDb();
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, userId));
  } catch (err) {
    throw new DbUnavailableError(err instanceof Error ? err.message : "Database unavailable");
  }
}

export async function ensureTestUser(input: {
  email: string;
  name: string;
  passwordHash: string;
}): Promise<void> {
  const existing = await findUserByEmail(input.email);
  if (existing) return;
  await createUser({
    id: crypto.randomUUID(),
    name: input.name,
    email: input.email.toLowerCase(),
    dob: new Date("2000-01-01").toISOString(),
    passwordHash: input.passwordHash,
    createdAt: new Date().toISOString(),
  });
}

export function publicUser(user: StoredUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    dob: user.dob,
    createdAt: user.createdAt,
  };
}

/** Bump profile counters after a finished match (Neon only; no-op on JSON). */
export async function bumpProfileAfterMatch(userId: string, won: boolean) {
  if (!usingDatabase()) return;
  try {
    const db = getDb();
    await db
      .insert(profilesTable)
      .values({
        userId,
        gamesPlayed: 1,
        wins: won ? 1 : 0,
        losses: won ? 0 : 1,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: profilesTable.userId,
        set: {
          gamesPlayed: sql`${profilesTable.gamesPlayed} + 1`,
          wins: won ? sql`${profilesTable.wins} + 1` : sql`${profilesTable.wins}`,
          losses: won ? sql`${profilesTable.losses}` : sql`${profilesTable.losses} + 1`,
          updatedAt: new Date(),
        },
      });
  } catch {
    throw new DbUnavailableError("Failed to update profile");
  }
}
