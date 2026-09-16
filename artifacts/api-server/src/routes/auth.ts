import { Router } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const router = Router();

const dataDir = path.resolve(import.meta.dirname, "..", "data");
const usersFile = path.join(dataDir, "users.json");

function ensureData() {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(usersFile)) fs.writeFileSync(usersFile, JSON.stringify({ users: [], sessions: {} }, null, 2));
  } catch (e) {
    // ignore
  }
}

function readStore(): { users: any[]; sessions: Record<string, any> } {
  ensureData();
  try {
    const raw = fs.readFileSync(usersFile, "utf8");
    return JSON.parse(raw);
  } catch {
    return { users: [], sessions: {} };
  }
}

function writeStore(store: { users: any[]; sessions: Record<string, any> }) {
  ensureData();
  fs.writeFileSync(usersFile, JSON.stringify(store, null, 2));
}

function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

router.post("/signup", (req, res) => {
  const { name, email, password, dob } = req.body ?? {};
  if (!name || !email || !password || !dob) return res.status(400).json({ message: "name, email, password and dob required" });
  // basic email sanity
  if (!String(email).includes("@")) return res.status(400).json({ message: "Invalid email" });
  // dob validation and age gate (13+)
  const parsedDob = new Date(String(dob));
  if (Number.isNaN(parsedDob.getTime())) return res.status(400).json({ message: "Invalid date of birth" });
  const ageMs = Date.now() - parsedDob.getTime();
  const ageYears = ageMs / (1000 * 60 * 60 * 24 * 365.25);
  if (ageYears < 13) return res.status(403).json({ message: "You must be at least 13 years old to sign up" });

  const store = readStore();
  const exists = store.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
  if (exists) return res.status(409).json({ message: "Email already registered" });

  const id = crypto.randomUUID();
  const user = { id, name: String(name), email: String(email).toLowerCase(), dob: parsedDob.toISOString(), passwordHash: hashPassword(String(password)), createdAt: new Date().toISOString() };
  store.users.push(user);
  // create session token
  const token = crypto.randomUUID();
  store.sessions[token] = { userId: id, createdAt: new Date().toISOString() };
  writeStore(store);
  return res.json({ user: { id: user.id, name: user.name, email: user.email, dob: user.dob, createdAt: user.createdAt }, token });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ message: "email and password required" });
  const store = readStore();
  const user = store.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
  if (!user) return res.status(401).json({ message: "Invalid credentials" });
  if (user.passwordHash !== hashPassword(String(password))) return res.status(401).json({ message: "Invalid credentials" });
  const token = crypto.randomUUID();
  store.sessions[token] = { userId: user.id, createdAt: new Date().toISOString() };
  writeStore(store);
  return res.json({ user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt }, token });
});

router.get("/me", (req, res) => {
  const auth = req.headers.authorization?.split(" ") ?? [];
  const token = auth[0] === "Bearer" ? auth[1] : null;
  if (!token) return res.status(401).json({ message: "Missing token" });
  const store = readStore();
  const s = store.sessions[token];
  if (!s) return res.status(401).json({ message: "Invalid token" });
  const user = store.users.find((u) => u.id === s.userId);
  if (!user) return res.status(401).json({ message: "Invalid token" });
  return res.json({ user: { id: user.id, name: user.name, createdAt: user.createdAt } });
});

export default router;
