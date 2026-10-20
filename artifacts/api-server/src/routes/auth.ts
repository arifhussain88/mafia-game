import { Router } from "express";
import crypto from "crypto";
import {
  countUsers,
  createAuthSession,
  createUser,
  DbUnavailableError,
  deleteSession,
  ensureTestUser,
  findUserByEmail,
  getUserForToken,
  hashPassword,
  publicUser,
  updatePasswordHash,
  verifyPassword,
} from "../lib/user-store";

const router = Router();

const TEST_PASSWORD = "testdev123";
const TEST_USERS = [
  { email: "mafia@test.local", name: "Mafia" },
  { email: "doctor@test.local", name: "Doctor" },
  { email: "detective@test.local", name: "Detective" },
  { email: "civilian@test.local", name: "Civilian" },
];

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 10;
const MAX_USERS = 500;

function clientIp(req: { ip?: string; headers: Record<string, unknown> }) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) return forwarded.split(",")[0].trim();
  return req.ip || "unknown";
}

function rateLimited(ip: string) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_MAX;
}

function isTestEmail(email: string) {
  return TEST_USERS.some((user) => user.email === email);
}

function isDbDown(err: unknown) {
  return err instanceof DbUnavailableError;
}

async function seedTestUsers() {
  if (process.env.NODE_ENV === "production") return;
  const passwordHash = await hashPassword(TEST_PASSWORD);
  for (const testUser of TEST_USERS) {
    try {
      await ensureTestUser({
        email: testUser.email,
        name: testUser.name,
        passwordHash,
      });
    } catch (err) {
      if (isDbDown(err)) return;
      throw err;
    }
  }
}

void seedTestUsers();

function bearerToken(req: { headers: { authorization?: string } }) {
  const auth = req.headers.authorization?.split(" ") ?? [];
  return auth[0] === "Bearer" ? auth[1] : null;
}

router.post("/signup", async (req, res) => {
  const ip = clientIp(req);
  if (rateLimited(ip)) return res.status(429).json({ message: "Too many attempts. Try again later." });

  const { name, email, password, dob } = req.body ?? {};
  if (!name || !email || !password || !dob) return res.status(400).json({ message: "name, email, password and dob required" });
  if (!String(email).includes("@")) return res.status(400).json({ message: "Invalid email" });
  const parsedDob = new Date(String(dob));
  if (Number.isNaN(parsedDob.getTime())) return res.status(400).json({ message: "Invalid date of birth" });
  const ageMs = Date.now() - parsedDob.getTime();
  const ageYears = ageMs / (1000 * 60 * 60 * 24 * 365.25);
  if (ageYears < 13) return res.status(403).json({ message: "You must be at least 13 years old to sign up" });
  if (String(password).length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });

  try {
    const total = await countUsers();
    if (total >= MAX_USERS) {
      return res.status(503).json({ message: "Signup is temporarily closed. Try again later." });
    }
    const exists = await findUserByEmail(String(email));
    if (exists) return res.status(409).json({ message: "Email already registered" });

    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(String(password));
    const user = await createUser({
      id,
      name: String(name),
      email: String(email).toLowerCase(),
      dob: parsedDob.toISOString(),
      passwordHash,
      createdAt: new Date().toISOString(),
    });
    const token = await createAuthSession(id);
    return res.json({ user: publicUser(user), token });
  } catch (err) {
    if (isDbDown(err)) {
      return res.status(503).json({ message: "Service temporarily unavailable. Try again." });
    }
    throw err;
  }
});

router.post("/login", async (req, res) => {
  const ip = clientIp(req);
  if (rateLimited(ip)) return res.status(429).json({ message: "Too many attempts. Try again later." });

  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ message: "email and password required" });
  const normalizedEmail = String(email).toLowerCase();
  if (process.env.NODE_ENV === "production" && isTestEmail(normalizedEmail)) {
    return res.status(403).json({ message: "Test accounts are disabled" });
  }

  try {
    const user = await findUserByEmail(normalizedEmail);
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await verifyPassword(String(password), user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    if (/^[a-f0-9]{64}$/i.test(user.passwordHash)) {
      const nextHash = await hashPassword(String(password));
      await updatePasswordHash(user.id, nextHash);
      user.passwordHash = nextHash;
    }

    const token = await createAuthSession(user.id);
    return res.json({ user: publicUser(user), token });
  } catch (err) {
    if (isDbDown(err)) {
      return res.status(503).json({ message: "Service temporarily unavailable. Try again." });
    }
    throw err;
  }
});

router.post("/logout", async (req, res) => {
  const token = bearerToken(req);
  try {
    await deleteSession(token);
    return res.json({ ok: true });
  } catch (err) {
    if (isDbDown(err)) {
      return res.status(503).json({ message: "Service temporarily unavailable. Try again." });
    }
    throw err;
  }
});

router.get("/me", async (req, res) => {
  const token = bearerToken(req);
  try {
    const user = await getUserForToken(token);
    if (!user) return res.status(401).json({ message: "Invalid token" });
    return res.json({ user: { id: user.id, name: user.name, createdAt: user.createdAt } });
  } catch (err) {
    if (isDbDown(err)) {
      return res.status(503).json({ message: "Service temporarily unavailable. Try again." });
    }
    throw err;
  }
});

export default router;
