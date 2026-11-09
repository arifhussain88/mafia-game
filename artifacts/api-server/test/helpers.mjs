// Test helpers: start the *built* server bundle (dist/index.mjs, exactly what
// ships to Oracle) as a child process with its own temp account store, and talk
// to it over real HTTP and Socket.IO.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { io } from "socket.io-client";

const here = path.dirname(fileURLToPath(import.meta.url));
const ENTRY = path.resolve(here, "..", "dist", "index.mjs");

/** Seeded by the server outside production (see routes/auth.ts). */
export const TEST_PASSWORD = "testdev123";
export const TEST_USERS = ["mafia", "doctor", "detective", "civilian"].map((r) => `${r}@test.local`);

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let nextPort = 20000 + Math.floor(Math.random() * 20000);

/**
 * Start a server. Resolves once /api/healthz answers.
 * @param {Record<string,string>} env extra environment (e.g. NODE_ENV, MAX_SOCKETS)
 */
export async function startServer(env = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "mafia-test-"));
  const port = nextPort++;
  const child = spawn(process.execPath, [ENTRY], {
    env: {
      ...process.env,
      DATABASE_URL: "",
      NODE_ENV: "test",
      HOST: "127.0.0.1",
      PORT: String(port),
      USERS_FILE: path.join(dir, "users.json"),
      LOG_LEVEL: "warn",
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (d) => (output += d));
  child.stderr.on("data", (d) => (output += d));

  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 15000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`server exited early (${child.exitCode}):\n${output}`);
    try {
      const res = await fetch(`${base}/api/healthz`);
      if (res.ok) break;
    } catch {}
    if (Date.now() > deadline) {
      child.kill();
      throw new Error(`server did not start:\n${output}`);
    }
    await sleep(100);
  }

  return {
    base,
    port,
    get output() { return output; },
    get alive() { return child.exitCode === null; },
    async stop() {
      if (child.exitCode === null) {
        child.kill();
        await new Promise((r) => child.once("exit", r));
      }
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export async function post(server, route, body, token) {
  const res = await fetch(`${server.base}${route}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, body: json };
}

/** Login retrying briefly: dev test users are seeded asynchronously at startup. */
export async function login(server, email, password = TEST_PASSWORD) {
  for (let i = 0; i < 30; i++) {
    const r = await post(server, "/api/auth/login", { email, password });
    if (r.status === 200) return r.body.token;
    await sleep(100);
  }
  throw new Error(`login failed for ${email}`);
}

let signupSeq = 0;
export async function signup(server, overrides = {}) {
  signupSeq += 1;
  const body = {
    name: `Player${signupSeq}`,
    email: `player${signupSeq}.${Date.now()}@example.test`,
    password: "correct-horse-1",
    dob: "1995-05-05",
    ...overrides,
  };
  const r = await post(server, "/api/auth/signup", body);
  return { ...r, email: body.email, password: body.password };
}

/** Connect a socket; every event it receives is recorded in `socket.events`. */
export function connect(server, token, opts = {}) {
  return new Promise((resolve, reject) => {
    const s = io(server.base, {
      path: "/socket.io",
      auth: token ? { token } : {},
      reconnection: false,
      transports: ["websocket"],
      forceNew: true,
      ...opts,
    });
    s.events = [];
    s.onAny((event, data) => s.events.push({ event, data }));
    s.once("connect", () => resolve(s));
    s.once("connect_error", (err) => {
      s.close();
      reject(err);
    });
  });
}

/** Resolve with the first `event` (already received or upcoming) matching `pred`. */
export function waitFor(socket, event, pred = () => true, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const hit = socket.events.find((e) => e.event === event && pred(e.data));
    if (hit) return resolve(hit.data);
    const onEvent = (data) => {
      if (!pred(data)) return;
      clearTimeout(timer);
      socket.off(event, onEvent);
      resolve(data);
    };
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`timed out waiting for "${event}"`));
    }, timeout);
    socket.on(event, onEvent);
  });
}

export const received = (socket, event) => socket.events.filter((e) => e.event === event).map((e) => e.data);
export const clearEvents = (...sockets) => sockets.forEach((s) => (s.events = []));

/** Four logged-in sockets seated in one lobby; names give fixed roles outside production. */
export async function seatTable(server) {
  const names = ["Mafia", "Doctor", "Detective", "Civilian"];
  const tokens = {};
  const sockets = {};
  for (const [i, email] of TEST_USERS.entries()) {
    tokens[names[i]] = await login(server, email);
    sockets[names[i]] = await connect(server, tokens[names[i]]);
  }
  sockets.Mafia.emit("create-room", { name: "Mafia" });
  const { code } = await waitFor(sockets.Mafia, "room-created");
  for (const n of names.slice(1)) {
    sockets[n].emit("join-room", { code, name: n });
    await waitFor(sockets[n], "room-joined");
  }
  return { code, tokens, sockets, closeAll: () => Object.values(sockets).forEach((s) => s.close()) };
}
