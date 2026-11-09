// Moderation: persisted reports, admin API, bans, profanity filter.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { connect, post, seatTable, signup, sleep, startServer, waitFor } from "./helpers.mjs";

const ADMIN_TOKEN = "test-admin-token-0123456789abcdef";
let server;
before(async () => { server = await startServer({ ADMIN_TOKEN }); });
after(async () => { await server?.stop(); });

async function admin(method, route, body, token = ADMIN_TOKEN) {
  const res = await fetch(`${server.base}/api/admin${route}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, body: json };
}

describe("admin API", () => {
  test("is invisible without the right token", async () => {
    assert.equal((await admin("GET", "/reports", null, null)).status, 404);
    assert.equal((await admin("GET", "/reports", null, "wrong-token-wrong-token-wrong")).status, 404);
    assert.equal((await admin("GET", "/reports")).status, 200);
  });

  test("is disabled entirely when ADMIN_TOKEN is not set", async () => {
    const plain = await startServer();
    try {
      const res = await fetch(`${plain.base}/api/admin/reports`, { headers: { authorization: `Bearer ${ADMIN_TOKEN}` } });
      assert.equal(res.status, 404);
    } finally {
      await plain.stop();
    }
  });
});

describe("reports", () => {
  test("player and chat reports are stored with who, why and what", async () => {
    const t = await seatTable(server);
    const { Mafia, Doctor } = t.sockets;
    try {
      Doctor.emit("report-player", { targetId: Mafia.id, reason: "offensive-name" });
      await waitFor(Doctor, "report-received");

      Mafia.emit("send-chat", { text: "you will never find me" });
      const msg = await waitFor(Doctor, "chat-message");
      Doctor.emit("report-chat", { id: msg.id, reason: "harassment" });
      await waitFor(Doctor, "report-received", () => true);
      await sleep(200);

      const { body } = await admin("GET", "/reports?status=all");
      const mine = body.reports.filter((r) => r.roomCode === t.code);
      const player = mine.find((r) => r.reason === "offensive-name");
      const chat = mine.find((r) => r.reason === "harassment");
      assert.ok(player && chat, "both reports saved");
      assert.equal(player.reportedName, "Mafia");
      assert.equal(player.reporterName, "Doctor");
      assert.ok(player.reportedId, "reported account id recorded");
      assert.equal(chat.message, "you will never find me");

      assert.equal((await admin("POST", `/reports/${chat.id}/status`, { status: "resolved" })).status, 200);
      const open = await admin("GET", "/reports");
      assert.ok(!open.body.reports.some((r) => r.id === chat.id), "resolved report left the open list");
    } finally {
      t.closeAll();
    }
  });

  test("unknown reasons are stored as other, and you can't report yourself", async () => {
    const t = await seatTable(server);
    const { Mafia, Civilian } = t.sockets;
    try {
      Civilian.emit("report-player", { targetId: Mafia.id, reason: "<script>" });
      await waitFor(Civilian, "report-received");
      Civilian.emit("report-player", { targetId: Civilian.id, reason: "spam" });
      await sleep(300);
      const { body } = await admin("GET", "/reports?status=all");
      const mine = body.reports.filter((r) => r.roomCode === t.code);
      assert.equal(mine.length, 1);
      assert.equal(mine[0].reason, "other");
    } finally {
      t.closeAll();
    }
  });
});

describe("bans", () => {
  test("a banned account is kicked, can't log in, and can be reinstated", async () => {
    const acct = await signup(server);
    const s = await connect(server, acct.body.token);
    const kicked = waitFor(s, "account-suspended");
    assert.equal((await admin("POST", "/ban", { email: acct.email, reason: "test" })).status, 200);
    await kicked;
    await sleep(200);
    assert.equal(s.connected, false);

    const login = await post(server, "/api/auth/login", { email: acct.email, password: acct.password });
    assert.equal(login.status, 403);
    assert.match(login.body.message, /suspended/i);
    await assert.rejects(connect(server, acct.body.token), /Unauthorized|suspended/i);

    assert.equal((await admin("POST", "/unban", { email: acct.email })).status, 200);
    assert.equal((await post(server, "/api/auth/login", { email: acct.email, password: acct.password })).status, 200);
  });

  test("banning an unknown account is a 404", async () => {
    assert.equal((await admin("POST", "/ban", { email: "nobody@example.test" })).status, 404);
  });
});

describe("profanity filter", () => {
  test("offensive display names are refused at signup and in rooms", async () => {
    assert.equal((await signup(server, { name: "fuck you" })).status, 400);
    assert.equal((await signup(server, { name: "sh1thead" })).status, 400);
    const ok = await signup(server, { name: "Assassin" });
    assert.equal(ok.status, 200, "ordinary words containing bad substrings are fine");

    const s = await connect(server, ok.body.token);
    s.emit("create-room", { name: "b1tch" });
    const err = await waitFor(s, "room-error");
    assert.match(err.message, /different display name/i);
    s.close();
  });

  test("chat is masked, not blocked, and clean words survive", async () => {
    const t = await seatTable(server);
    const { Mafia, Doctor } = t.sockets;
    try {
      Mafia.emit("send-chat", { text: "you f.u.c.k.i.n.g idiot, classic assassin move" });
      const msg = await waitFor(Doctor, "chat-message");
      assert.ok(!/fuck/i.test(msg.text.replace(/[^a-z]/gi, "")), `not masked: ${msg.text}`);
      assert.match(msg.text, /classic assassin move/);
    } finally {
      t.closeAll();
    }
  });
});
