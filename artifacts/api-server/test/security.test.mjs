// Security checks against the built server. Run: npm test (in artifacts/api-server).
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  TEST_USERS,
  clearEvents,
  connect,
  login,
  post,
  received,
  seatTable,
  signup,
  sleep,
  startServer,
  waitFor,
} from "./helpers.mjs";

let server;
before(async () => { server = await startServer(); });
after(async () => { await server?.stop(); });

describe("HTTP auth", () => {
  test("signup rejects bad input", async () => {
    assert.equal((await signup(server, { email: "not-an-email" })).status, 400);
    assert.equal((await signup(server, { password: "short" })).status, 400);
    assert.equal((await signup(server, { name: "x".repeat(25) })).status, 400);
    assert.equal((await signup(server, { name: "" })).status, 400);
    assert.equal((await post(server, "/api/auth/signup", {})).status, 400);
    const kid = new Date(Date.now() - 10 * 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    assert.equal((await signup(server, { dob: kid })).status, 403, "under-13 signup must be refused");
  });

  test("signup never returns the password hash", async () => {
    const r = await signup(server);
    assert.equal(r.status, 200);
    assert.ok(r.body.token);
    const text = JSON.stringify(r.body);
    assert.ok(!/passwordHash|correct-horse/i.test(text), "response leaked password data");
  });

  test("duplicate email is refused, case-insensitively", async () => {
    const first = await signup(server);
    const again = await signup(server, { email: first.email.toUpperCase() });
    assert.equal(again.status, 409);
  });

  test("wrong password and unknown email give the same answer (no account probing)", async () => {
    const acct = await signup(server);
    const wrong = await post(server, "/api/auth/login", { email: acct.email, password: "nope-nope-1" });
    const unknown = await post(server, "/api/auth/login", { email: "nobody@example.test", password: "nope-nope-1" });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.deepEqual(wrong.body, unknown.body);
  });

  test("password guessing is rate limited per account", async () => {
    const acct = await signup(server);
    let last;
    for (let i = 0; i < 11; i++) {
      last = await post(server, "/api/auth/login", { email: acct.email, password: `guess-${i}-xx` });
    }
    assert.equal(last.status, 429, "11th failed login should be throttled");
    // Even the right password is blocked while throttled...
    assert.equal((await post(server, "/api/auth/login", { email: acct.email, password: acct.password })).status, 429);
    // ...but other accounts on the same network still get in.
    const other = await signup(server);
    assert.equal((await post(server, "/api/auth/login", { email: other.email, password: other.password })).status, 200);
  });

  test("oversized and malformed bodies are rejected cleanly", async () => {
    const big = JSON.stringify({ email: "a@b.co", password: "x".repeat(20 * 1024) });
    assert.equal((await post(server, "/api/auth/login", big)).status, 413);
    assert.equal((await post(server, "/api/auth/login", "{not json")).status, 400);
  });

  test("account deletion needs a valid session and the password", async () => {
    const acct = await signup(server);
    const token = acct.body.token;
    assert.equal((await post(server, "/api/auth/delete-account", { password: acct.password })).status, 401);
    assert.equal((await post(server, "/api/auth/delete-account", {}, token)).status, 400);
    assert.equal((await post(server, "/api/auth/delete-account", { password: "wrong-pass-1" }, token)).status, 401);
    assert.equal((await post(server, "/api/auth/delete-account", { password: acct.password }, token)).status, 200);
    // Session and account are gone.
    assert.equal((await post(server, "/api/auth/login", { email: acct.email, password: acct.password })).status, 401);
  });

  test("responses don't advertise the framework", async () => {
    const res = await fetch(`${server.base}/api/healthz`);
    assert.equal(res.headers.get("x-powered-by"), null);
  });
});

describe("Socket.IO", () => {
  test("connections without a valid session are refused", async () => {
    await assert.rejects(connect(server, null), /Unauthorized/);
    await assert.rejects(connect(server, "forged-token"), /Unauthorized/);
  });

  test("malformed payloads never crash the server", async () => {
    const token = await login(server, TEST_USERS[3]);
    const s = await connect(server, token);
    const junk = [undefined, null, 42, "x", [], { name: 1 }, { code: {}, name: [] }, { targetId: { $ne: "" } }, { text: { a: 1 } }];
    const events = ["create-room", "join-room", "rejoin-room", "kick-player", "start-game", "night-vote", "doctor-protect",
      "detective-investigate", "day-vote", "send-chat", "report-chat", "block-player", "set-timer-settings", "leave-game", "play-again"];
    for (const ev of events) for (const payload of junk) s.emit(ev, payload);
    await sleep(500);
    assert.ok(server.alive, `server died:\n${server.output}`);
    assert.equal((await fetch(`${server.base}/api/healthz`)).status, 200);
    s.emit("leave-game");
    s.close();
  });

  test("roles stay private and the host can't be spoofed", async () => {
    const t = await seatTable(server);
    const { Mafia, Doctor, Detective, Civilian } = t.sockets;
    try {
      // Non-host can't start or kick.
      Doctor.emit("start-game");
      Doctor.emit("kick-player", { targetId: Civilian.id });
      const err = await waitFor(Doctor, "room-error");
      assert.match(err.message, /host/i);
      await sleep(200);
      assert.equal(received(Civilian, "kicked").length, 0);

      clearEvents(Mafia, Doctor, Detective, Civilian);
      Mafia.emit("start-game");
      await waitFor(Mafia, "game-phase", (d) => d.phase === "night-mafia");

      for (const [name, s] of Object.entries({ Mafia, Doctor, Detective, Civilian })) {
        const roles = received(s, "role-assigned");
        assert.equal(roles.length, 1, `${name} should get exactly one role message`);
        if (name !== "Mafia") assert.deepEqual(roles[0].mafiaIds, [], `${name} must not learn who the Mafia are`);
        for (const phase of received(s, "game-phase")) {
          assert.ok(phase.players.every((p) => !("role" in p)), "roles leaked in a phase update");
        }
      }
      // Mafia head-count is only for the Mafia.
      await waitFor(Mafia, "night-vote-status");
      await sleep(200);
      for (const s of [Doctor, Detective, Civilian]) assert.equal(received(s, "night-vote-status").length, 0);

      // Town can't cast the Mafia's vote.
      Doctor.emit("night-vote", { targetId: Civilian.id });
      await sleep(200);
      const status = received(Mafia, "night-vote-status").at(-1);
      assert.equal(status.voted, 0, "a non-Mafia vote was counted");
    } finally {
      t.closeAll();
    }
  });

  test("nobody can take a dropped player's seat by using their name", async () => {
    const t = await seatTable(server);
    const { Mafia, Doctor } = t.sockets;
    try {
      Mafia.emit("start-game");
      await waitFor(Mafia, "game-phase", (d) => d.phase === "night-mafia");
      Doctor.close(); // Doctor drops
      await sleep(300);

      const attacker = await signup(server, { name: "Doctor" });
      const s = await connect(server, attacker.body.token);
      s.emit("join-room", { code: t.code, name: "Doctor" });
      s.emit("rejoin-room", { code: t.code });
      const err = await waitFor(s, "room-error");
      assert.match(err.message, /already started/i);
      await sleep(300);
      assert.equal(received(s, "role-assigned").length, 0, "attacker received a role");
      assert.equal(received(s, "reconnected").length, 0, "attacker was seated");
      s.close();
    } finally {
      t.closeAll();
    }
  });

  test("a kicked player stops receiving the room's events", async () => {
    const t = await seatTable(server);
    const { Mafia, Civilian } = t.sockets;
    try {
      Mafia.emit("kick-player", { targetId: Civilian.id });
      await waitFor(Civilian, "kicked");
      clearEvents(Civilian);
      Mafia.emit("send-chat", { text: "after the kick" });
      await sleep(400);
      assert.equal(received(Civilian, "chat-message").length, 0);
    } finally {
      t.closeAll();
    }
  });
});

describe("production mode", () => {
  let prod;
  before(async () => { prod = await startServer({ NODE_ENV: "production", MAX_SOCKETS: "2" }); });
  after(async () => { await prod?.stop(); });

  test("dev test logins are disabled", async () => {
    await sleep(300);
    const r = await post(prod, "/api/auth/login", { email: TEST_USERS[0], password: "testdev123" });
    assert.notEqual(r.status, 200);
  });

  test("the server caps concurrent connections", async () => {
    const acct = await signup(prod);
    const token = acct.body.token;
    const a = await connect(prod, token);
    const b = await connect(prod, token);
    await assert.rejects(connect(prod, token), /Server is full/);
    a.close();
    b.close();
  });
});
