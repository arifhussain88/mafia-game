import fs from "fs";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const BCRYPT_ROUNDS = 10;

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

export function createSession(store: UserStore, userId: string) {
  const token = crypto.randomUUID();
  store.sessions[token] = { userId, createdAt: new Date().toISOString() };
  return token;
}

export function getUserForToken(token: string | null | undefined): StoredUser | null {
  if (!token) return null;
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

export function deleteSession(token: string | null | undefined) {
  if (!token) return;
  const store = readStore();
  if (store.sessions[token]) {
    delete store.sessions[token];
    writeStore(store);
  }
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
