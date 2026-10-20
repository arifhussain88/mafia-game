/**
 * Integration checks for always-on chat, soft reconnect ticker, and leave forfeit.
 * Requires API on API_URL (default http://127.0.0.1:8080) with NODE_ENV !== production.
 */
import { io } from "../../game-lobby/node_modules/socket.io-client/build/esm/index.js";

const API = process.env.API_URL || "http://127.0.0.1:8080";
const PASSWORD = "testdev123";
const SEATS = [
  { email: "mafia@test.local", name: "Mafia" },
  { email: "doctor@test.local", name: "Doctor" },
  { email: "detective@test.local", name: "Detective" },
  { email: "civilian@test.local", name: "Civilian" },
];

const results = [];
function pass(name, detail = "") {
  results.push({ ok: true, name, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ ok: false, name, detail });
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function login(email) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`login ${email}: ${res.status} ${JSON.stringify(body)}`);
  return body.token;
}

function connect(name, token) {
  return new Promise((resolve, reject) => {
    const socket = io(API, {
      transports: ["websocket"],
      auth: { token },
    });
    const state = {
      name,
      socket,
      id: null,
      role: null,
      phase: null,
      players: [],
      chats: [],
      leftTicker: [],
      rejoinedTicker: [],
      leftGame: false,
      nightSummary: null,
      dayResult: null,
      gameOver: null,
      errors: [],
    };
    socket.on("connect", () => {
      state.id = socket.id;
    });
    socket.on("room-error", (e) => state.errors.push(e?.message || JSON.stringify(e)));
    socket.on("role-assigned", (d) => {
      state.role = d.role;
    });
    socket.on("game-phase", (d) => {
      state.phase = d.phase;
      state.players = d.players || state.players;
    });
    socket.on("players-updated", (d) => {
      state.players = d.players || state.players;
    });
    socket.on("chat-message", (m) => state.chats.push(m));
    socket.on("player-left", (d) => state.leftTicker.push(d?.name));
    socket.on("player-rejoined", (d) => state.rejoinedTicker.push(d?.name));
    socket.on("left-game", () => {
      state.leftGame = true;
    });
    socket.on("night-summary", (d) => {
      state.nightSummary = d;
      state.phase = "night-summary";
      state.players = d.players || state.players;
    });
    socket.on("day-result", (d) => {
      state.dayResult = d;
      state.phase = "day-result";
    });
    socket.on("game-over", (d) => {
      state.gameOver = d;
      state.phase = "game-over";
    });

    const t = setTimeout(() => reject(new Error(`connect timeout ${name}`)), 10000);
    socket.on("connect", () => {
      clearTimeout(t);
      resolve(state);
    });
    socket.on("connect_error", (err) => {
      clearTimeout(t);
      reject(err);
    });
  });
}

function waitFor(state, pred, label, ms = 20000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const id = setInterval(() => {
      if (pred(state)) {
        clearInterval(id);
        resolve();
      } else if (Date.now() - start > ms) {
        clearInterval(id);
        reject(new Error(`timeout ${label} (${state.name} phase=${state.phase})`));
      }
    }, 40);
  });
}

function waitAll(states, pred, label, ms = 20000) {
  return Promise.all(states.map((s) => waitFor(s, pred, `${label}/${s.name}`, ms)));
}

function byName(states, name) {
  return states.find((s) => s.name === name);
}

function playerId(state, name) {
  return state.players.find((p) => p.name === name)?.id;
}

async function main() {
  console.log(`API ${API}`);

  const tokens = {};
  for (const seat of SEATS) {
    tokens[seat.name] = await login(seat.email);
  }
  pass("login four test accounts");

  const states = [];
  for (const seat of SEATS) {
    states.push(await connect(seat.name, tokens[seat.name]));
  }
  pass("sockets connected");

  const host = byName(states, "Mafia");
  await new Promise((resolve, reject) => {
    host.socket.once("room-created", (d) => {
      host.code = d.code;
      resolve();
    });
    host.socket.once("room-error", (e) => reject(new Error(JSON.stringify(e))));
    host.socket.emit("create-room", { name: "Mafia" });
    setTimeout(() => reject(new Error("create-room timeout")), 5000);
  });
  pass("create room", host.code);

  for (const name of ["Doctor", "Detective", "Civilian"]) {
    const seat = byName(states, name);
    await new Promise((resolve, reject) => {
      seat.socket.once("room-joined", () => resolve());
      seat.socket.once("room-error", (e) => reject(new Error(JSON.stringify(e))));
      seat.socket.emit("join-room", { code: host.code, name });
      setTimeout(() => reject(new Error(`join timeout ${name}`)), 5000);
    });
  }
  pass("four players joined");

  // Lobby chat
  for (const s of states) s.chats = [];
  const lobbyText = `lobby-chat-${Date.now()}`;
  byName(states, "Doctor").socket.emit("send-chat", { text: lobbyText });
  await waitAll(states, (s) => s.chats.some((m) => m.text === lobbyText), "lobby chat", 5000);
  pass("lobby chat broadcast");

  // Short timers so day vote is reachable
  host.socket.emit("set-timer-settings", {
    nightStepSec: 20,
    dayDiscussionSec: 30,
    dayVoteSec: 20,
  });
  await new Promise((r) => setTimeout(r, 200));

  host.socket.emit("start-game");
  await waitAll(states, (s) => s.phase === "match-countdown", "match-countdown");
  await waitAll(states, (s) => s.phase === "role-reveal" && s.role, "role-reveal");
  const expected = { Mafia: "mafia", Doctor: "doctor", Detective: "detective", Civilian: "civilian" };
  for (const s of states) {
    if (s.role === expected[s.name]) pass(`role ${s.name}`, s.role);
    else fail(`role ${s.name}`, `got ${s.role}`);
  }

  await waitAll(states, (s) => s.phase === "night-mafia", "night-mafia");

  // Night chat must be allowed now
  for (const s of states) s.chats = [];
  const nightText = `night-chat-${Date.now()}`;
  byName(states, "Civilian").socket.emit("send-chat", { text: nightText });
  await waitAll(states, (s) => s.chats.some((m) => m.text === nightText), "night chat", 5000);
  pass("night chat allowed");

  // Soft disconnect + rejoin (Doctor)
  const doctor = byName(states, "Doctor");
  const code = host.code;
  for (const s of states) s.rejoinedTicker = [];
  doctor.socket.disconnect();
  await new Promise((r) => setTimeout(r, 400));

  const doctorToken = tokens.Doctor;
  const doctor2 = await connect("Doctor", doctorToken);
  await new Promise((resolve, reject) => {
    doctor2.socket.once("reconnected", () => resolve());
    doctor2.socket.once("room-error", (e) => reject(new Error(JSON.stringify(e))));
    doctor2.socket.emit("join-room", { code, name: "Doctor" });
    setTimeout(() => reject(new Error("doctor reconnect timeout")), 8000);
  });
  // Replace doctor seat in states
  const docIdx = states.findIndex((s) => s.name === "Doctor");
  states[docIdx] = doctor2;
  doctor2.code = code;

  await waitFor(
    byName(states, "Mafia"),
    (s) => s.rejoinedTicker.includes("Doctor"),
    "doctor rejoined ticker",
    5000,
  );
  pass("soft rejoin ticker", "Doctor");

  // Play night: mafia kills civilian; doctor protects self; detective checks mafia
  const mafia = byName(states, "Mafia");
  const detective = byName(states, "Detective");
  const civilianId = playerId(mafia, "Civilian");
  const mafiaId = playerId(mafia, "Mafia");
  const doctorId = playerId(doctor2, "Doctor") || playerId(mafia, "Doctor");

  mafia.socket.emit("night-vote", { targetId: civilianId });
  await waitAll(states, (s) => s.phase === "night-doctor", "night-doctor", 15000);
  doctor2.socket.emit("doctor-protect", { targetId: doctorId });
  await waitAll(states, (s) => s.phase === "night-detective", "night-detective", 15000);
  detective.socket.emit("detective-investigate", { targetId: mafiaId });
  await waitAll(states, (s) => s.phase === "night-summary", "night-summary", 20000);
  pass("night resolved");

  await waitAll(states, (s) => s.phase === "day-discussion", "day-discussion", 25000);

  // Leave forfeit: sole mafia leaves → town wins after grace (~15s)
  for (const s of states) s.leftTicker = [];
  mafia.socket.emit("leave-game");
  await waitFor(mafia, (s) => s.leftGame, "left-game ack", 5000);
  pass("leave-game ack");

  // Remaining seats should see player-left after grace
  const remain = states.filter((s) => s.name !== "Mafia");
  await waitAll(remain, (s) => s.leftTicker.includes("Mafia"), "mafia left ticker", 20000);
  pass("leave ticker after grace", "Mafia");

  await waitAll(remain, (s) => s.phase === "game-over" || s.gameOver, "town win after mafia leave", 10000);
  const winner = remain.find((s) => s.gameOver)?.gameOver?.winner;
  if (winner === "civilians") pass("sole mafia leave ends game", "civilians");
  else fail("sole mafia leave ends game", `winner=${winner}`);

  // Forfeited name cannot rejoin mid-match (room already game-over — check error on join to same code while game-over)
  // Start a fresh micro check: forfeited during match blocks reconnect.
  // Already game-over; verify join as Mafia to this finished room fails or reconnects as soft if not forfeited seat.
  // Create a quick second room to verify forfeit block during active match.
  for (const s of states) s.socket.disconnect();

  // --- Second room: forfeit block + majority skip ---
  const states2 = [];
  for (const seat of SEATS) states2.push(await connect(seat.name, tokens[seat.name]));
  const host2 = byName(states2, "Mafia");
  await new Promise((resolve, reject) => {
    host2.socket.once("room-created", (d) => {
      host2.code = d.code;
      resolve();
    });
    host2.socket.emit("create-room", { name: "Mafia" });
    setTimeout(() => reject(new Error("create2 timeout")), 5000);
  });
  for (const name of ["Doctor", "Detective", "Civilian"]) {
    const seat = byName(states2, name);
    await new Promise((resolve, reject) => {
      seat.socket.once("room-joined", () => resolve());
      seat.socket.emit("join-room", { code: host2.code, name });
      setTimeout(() => reject(new Error(`join2 ${name}`)), 5000);
    });
  }
  host2.socket.emit("set-timer-settings", { nightStepSec: 20, dayDiscussionSec: 25, dayVoteSec: 15 });
  await new Promise((r) => setTimeout(r, 150));
  host2.socket.emit("start-game");
  await waitAll(states2, (s) => s.phase === "night-mafia", "room2 night-mafia", 25000);

  // Soft disconnect Civilian, then leave Doctor (not sole-mafia path — just forfeit block)
  const civ2 = byName(states2, "Civilian");
  const civToken = tokens.Civilian;
  const room2 = host2.code;
  civ2.socket.disconnect();
  await new Promise((r) => setTimeout(r, 300));

  // Doctor leaves intentionally
  const doc2 = byName(states2, "Doctor");
  doc2.socket.emit("leave-game");
  await waitFor(doc2, (s) => s.leftGame, "doctor left-game", 5000);

  // Doctor tries to rejoin during grace / after — must fail
  const docBlocked = await connect("Doctor", tokens.Doctor);
  let blockMsg = null;
  await new Promise((resolve) => {
    docBlocked.socket.once("room-error", (e) => {
      blockMsg = e?.message || JSON.stringify(e);
      resolve();
    });
    docBlocked.socket.once("reconnected", () => resolve());
    docBlocked.socket.emit("join-room", { code: room2, name: "Doctor" });
    setTimeout(resolve, 4000);
  });
  if (blockMsg && /left|cannot rejoin/i.test(blockMsg)) pass("forfeit blocks rejoin", blockMsg);
  else fail("forfeit blocks rejoin", `msg=${blockMsg}`);

  // Soft reconnect Civilian still works
  const civBack = await connect("Civilian", civToken);
  let civOk = false;
  await new Promise((resolve, reject) => {
    civBack.socket.once("reconnected", () => {
      civOk = true;
      resolve();
    });
    civBack.socket.once("room-error", (e) => reject(new Error(JSON.stringify(e))));
    civBack.socket.emit("join-room", { code: room2, name: "Civilian" });
    setTimeout(() => reject(new Error("civ reconnect timeout")), 8000);
  });
  if (civOk) pass("soft reconnect still works after someone else left");
  else fail("soft reconnect still works after someone else left");

  for (const s of [...states2, docBlocked, civBack]) s.socket.disconnect();

  const failed = results.filter((r) => !r.ok);
  console.log("\n=== SUMMARY ===");
  console.log(`${results.filter((r) => r.ok).length}/${results.length} passed`);
  if (failed.length) {
    for (const f of failed) console.log(`- ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log("leave-chat integration checks complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
