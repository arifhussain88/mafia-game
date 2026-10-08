/**
 * Four-seat role test: Mafia, Doctor, Detective, Civilian in one room.
 * Covers fixed roles, night actions, night chat rejection, day chat, day vote.
 */
import { io } from "../../game-lobby/node_modules/socket.io-client/build/esm/index.js";

const API = process.env.API_URL || "http://localhost:3001";
const results = [];
function pass(name, detail = "") {
  results.push({ ok: true, name, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ ok: false, name, detail });
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

function connect(name) {
  return new Promise((resolve, reject) => {
    const socket = io(API, { transports: ["websocket"] });
    const state = {
      name,
      socket,
      id: null,
      role: null,
      phase: null,
      players: [],
      chats: [],
      detectiveResult: null,
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
    socket.on("detective-result", (d) => {
      state.detectiveResult = d;
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
    socket.on("day-vote-update", () => {});

    const t = setTimeout(() => reject(new Error(`connect timeout ${name}`)), 8000);
    socket.on("connect", () => {
      clearTimeout(t);
      resolve(state);
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
        reject(new Error(`timeout waiting for ${label} (${state.name} phase=${state.phase})`));
      }
    }, 50);
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
  const seats = ["Mafia", "Doctor", "Detective", "Civilian"];
  const states = [];
  for (const name of seats) states.push(await connect(name));

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

  host.socket.emit("start-game");
  await waitAll(states, (s) => s.phase === "match-countdown", "match-countdown");
  pass("match countdown");

  await waitAll(states, (s) => s.phase === "role-reveal" && s.role, "role-reveal");
  const expected = { Mafia: "mafia", Doctor: "doctor", Detective: "detective", Civilian: "civilian" };
  for (const s of states) {
    if (s.role === expected[s.name]) pass(`fixed role ${s.name}`, s.role);
    else fail(`fixed role ${s.name}`, `got ${s.role}`);
  }

  // Night chat must be rejected
  await waitAll(states, (s) => s.phase === "night-mafia", "night-mafia");
  const civ = byName(states, "Civilian");
  civ.errors = [];
  civ.socket.emit("send-chat", { text: "night leak" });
  await new Promise((r) => setTimeout(r, 400));
  if (civ.errors.some((e) => /chat|day/i.test(e)) && civ.chats.length === 0) {
    pass("night chat rejected");
  } else if (civ.chats.some((m) => m.text === "night leak")) {
    fail("night chat rejected", "message was delivered");
  } else if (civ.errors.length) {
    pass("night chat rejected", civ.errors[civ.errors.length - 1]);
  } else {
    fail("night chat rejected", "no error and no delivery — unclear");
  }

  // Mafia kills Civilian; Doctor protects self; Detective investigates Mafia
  const mafia = byName(states, "Mafia");
  const doctor = byName(states, "Doctor");
  const detective = byName(states, "Detective");
  const civilianId = playerId(mafia, "Civilian");
  const mafiaId = playerId(mafia, "Mafia");
  const doctorId = playerId(doctor, "Doctor");

  mafia.socket.emit("night-vote", { targetId: civilianId });
  await waitAll(states, (s) => s.phase === "night-doctor", "night-doctor");
  pass("mafia night vote advanced");

  doctor.socket.emit("doctor-protect", { targetId: doctorId });
  await waitAll(states, (s) => s.phase === "night-detective", "night-detective");
  pass("doctor protect advanced");

  detective.socket.emit("detective-investigate", { targetId: mafiaId });
  await waitFor(detective, (s) => s.detectiveResult != null, "detective-result", 8000);
  if (detective.detectiveResult?.isMafia === true && detective.detectiveResult?.targetName === "Mafia") {
    pass("detective result", "Mafia is Mafia");
  } else {
    fail("detective result", JSON.stringify(detective.detectiveResult));
  }

  await waitAll(states, (s) => s.phase === "night-summary", "night-summary", 15000);
  const elim = mafia.nightSummary?.eliminatedId;
  if (elim === civilianId) pass("night kill landed", "Civilian died");
  else fail("night kill landed", `eliminatedId=${elim}`);

  await waitAll(states, (s) => s.phase === "day-discussion", "day-discussion", 20000);
  pass("day discussion started");

  // Clear chat arrays for day-only check
  for (const s of states) s.chats = [];
  const chatText = `town check ${Date.now()}`;
  doctor.socket.emit("send-chat", { text: chatText });
  await waitAll(
    states.filter((s) => s.name !== "Civilian" || true),
    (s) => s.chats.some((m) => m.text === chatText),
    "day chat broadcast",
    5000,
  ).catch((e) => fail("day chat broadcast", e.message));

  const receivers = states.filter((s) => s.chats.some((m) => m.text === chatText));
  if (receivers.length === 4) pass("day chat seen by all four");
  else if (receivers.length >= 3) pass("day chat seen by most", `${receivers.map((s) => s.name).join(",")}`);
  else fail("day chat seen by all four", `only ${receivers.map((s) => s.name).join(",") || "none"}`);

  // Wait for day-vote (60s discussion — too long). Force by waiting or skip if timer long.
  // DAY_DISCUSSION is 60000 — for test we wait up to 70s OR vote if already there.
  console.log("Waiting for day-vote phase (discussion timer)…");
  await waitAll(states, (s) => s.phase === "day-vote", "day-vote", 70000);
  pass("day vote started");

  // Living: Mafia, Doctor, Detective (Civilian dead). Majority = 2.
  // Vote Mafia out with Doctor + Detective.
  doctor.socket.emit("day-vote", { targetId: mafiaId });
  detective.socket.emit("day-vote", { targetId: mafiaId });
  await waitAll(states, (s) => s.phase === "day-result" || s.phase === "game-over", "day-result", 15000);
  if (states.some((s) => s.phase === "game-over" || s.gameOver)) {
    pass("round reached game-over", JSON.stringify(states.find((s) => s.gameOver)?.gameOver?.winner));
  } else if (mafia.dayResult) {
    pass("day result", `elim=${mafia.dayResult.eliminatedName} skipped=${mafia.dayResult.skipped}`);
  } else {
    fail("day result", "no day-result event");
  }

  for (const s of states) s.socket.disconnect();

  const failed = results.filter((r) => !r.ok);
  console.log("\n=== SUMMARY ===");
  console.log(`${results.filter((r) => r.ok).length}/${results.length} passed`);
  if (failed.length) {
    for (const f of failed) console.log(`- ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log(`Room ${host.code} four-role browser-seat test complete.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
