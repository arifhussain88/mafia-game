// Gameplay / reconnect checks against the built server.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { clearEvents, connect, received, seatTable, sleep, startServer, waitFor } from "./helpers.mjs";

let server;
before(async () => { server = await startServer(); });
after(async () => { await server?.stop(); });

describe("lobby", () => {
  test("a host's network blip keeps their seat and host role", async () => {
    const t = await seatTable(server);
    try {
      t.sockets.Mafia.close();
      await sleep(300);
      const back = await connect(server, t.tokens.Mafia);
      t.sockets.Mafia = back;
      back.emit("rejoin-room", { code: t.code });
      const snap = await waitFor(back, "reconnected");
      assert.equal(snap.phase, "lobby");
      assert.equal(snap.isHost, true);
      assert.equal(snap.players.length, 4);
    } finally {
      t.closeAll();
    }
  });

  test("when the host leaves, the room closes and everyone goes home", async () => {
    const t = await seatTable(server);
    try {
      const { Mafia, Doctor, Detective, Civilian } = t.sockets;
      Mafia.emit("leave-game");
      await waitFor(Mafia, "left-game");
      for (const s of [Doctor, Detective, Civilian]) {
        const closed = await waitFor(s, "room-closed");
        assert.match(closed.message, /host/i);
      }
      // The room is gone: its code no longer works.
      Doctor.emit("join-room", { code: t.code, name: "Doctor" });
      await waitFor(Doctor, "room-error");
    } finally {
      t.closeAll();
    }
  });

  test("leaving a lobby frees you to create a new room", async () => {
    const t = await seatTable(server);
    try {
      const { Civilian } = t.sockets;
      Civilian.emit("leave-game");
      await waitFor(Civilian, "left-game");
      Civilian.emit("create-room", { name: "Civilian" });
      await waitFor(Civilian, "room-created");
      Civilian.emit("leave-game");
    } finally {
      t.closeAll();
    }
  });
});

describe("match", () => {
  test("rejoin mid-night keeps role, vote and teammates in sync", async () => {
    const t = await seatTable(server);
    try {
      const { Mafia, Civilian } = t.sockets;
      Mafia.emit("start-game");
      await waitFor(Mafia, "game-phase", (d) => d.phase === "night-mafia");
      const target = Civilian.id;
      Mafia.emit("night-vote", { targetId: target });
      await sleep(100);

      Mafia.close();
      await sleep(300);
      const back = await connect(server, t.tokens.Mafia);
      t.sockets.Mafia = back;
      back.emit("rejoin-room", { code: t.code });
      const snap = await waitFor(back, "reconnected");
      const role = await waitFor(back, "role-assigned");
      assert.equal(snap.name, "Mafia");
      assert.ok(String(snap.phase).startsWith("night"), snap.phase);
      if (snap.phase === "night-mafia") assert.equal(snap.myNightVote, target);
      assert.equal(role.role, "mafia");
      assert.ok(role.mafiaIds.includes(back.id), "teammate list must use the new connection id");
      // Others hear about it; the rejoiner doesn't get told about themself.
      await waitFor(t.sockets.Doctor, "player-rejoined");
      assert.equal(received(back, "player-rejoined").length, 0);
    } finally {
      t.closeAll();
    }
  });

  test("a second device takes over the seat and the old one is cut", async () => {
    const t = await seatTable(server);
    try {
      t.sockets.Mafia.emit("start-game");
      await waitFor(t.sockets.Mafia, "game-phase", (d) => d.phase === "night-mafia");
      const old = t.sockets.Detective;
      const fresh = await connect(server, t.tokens.Detective);
      fresh.emit("rejoin-room", { code: t.code });
      const snap = await waitFor(fresh, "reconnected");
      assert.ok(snap.players.some((p) => p.id === fresh.id));
      await sleep(300);
      assert.equal(old.disconnected, true);
      t.sockets.Detective = fresh;
    } finally {
      t.closeAll();
    }
  });

  test("leaving mid-match forfeits for good but lets you play elsewhere", async () => {
    const t = await seatTable(server);
    try {
      const { Mafia, Civilian } = t.sockets;
      Mafia.emit("start-game");
      await waitFor(Mafia, "game-phase", (d) => d.phase === "night-mafia");
      Civilian.emit("leave-game");
      await waitFor(Civilian, "left-game");
      Civilian.emit("rejoin-room", { code: t.code });
      await waitFor(Civilian, "rejoin-failed");
      clearEvents(Civilian);
      Civilian.emit("create-room", { name: "Civilian" });
      await waitFor(Civilian, "room-created");
      Civilian.emit("leave-game");
    } finally {
      t.closeAll();
    }
  });

  test("typing the code of a game you're in resumes your seat", async () => {
    const t = await seatTable(server);
    try {
      t.sockets.Mafia.emit("start-game");
      await waitFor(t.sockets.Mafia, "game-phase", (d) => d.phase === "night-mafia");
      const again = await connect(server, t.tokens.Doctor);
      again.emit("join-room", { code: t.code, name: "Anything" });
      const snap = await waitFor(again, "reconnected");
      assert.equal(snap.name, "Doctor");
      t.sockets.Doctor = again;
    } finally {
      t.closeAll();
    }
  });
});

describe("table rules and chat channels", () => {
  test("a match needs at least 4 players", async () => {
    const t = await seatTable(server);
    try {
      t.sockets.Civilian.emit("leave-game");
      await waitFor(t.sockets.Civilian, "left-game");
      t.sockets.Mafia.emit("start-game");
      const err = await waitFor(t.sockets.Mafia, "room-error");
      assert.match(err.message, /at least 4/);
    } finally {
      t.closeAll();
    }
  });

  test("chat confirms each message, and a rejected one says why", async () => {
    const t = await seatTable(server);
    try {
      const { Mafia, Doctor } = t.sockets;
      const reply = await Mafia.timeout(5000).emitWithAck("send-chat", { text: "hello town" });
      assert.equal(reply.ok, true);
      const got = await waitFor(Doctor, "chat-message", (m) => m.text === "hello town");
      assert.equal(got.id, reply.id);
      // Too fast after the last one: refused through the ack, not lost silently.
      const tooFast = await Mafia.timeout(5000).emitWithAck("send-chat", { text: "again" });
      assert.equal(tooFast.ok, false);
      assert.match(tooFast.message, /moment/i);
      await sleep(800);
      assert.equal((await Mafia.timeout(5000).emitWithAck("send-chat", { text: "again" })).ok, true);
    } finally {
      t.closeAll();
    }
  });

  test("night chat is Mafia-only, the dead get a ghost channel, and the vote tally is secret", async () => {
    const t = await seatTable(server);
    const { Mafia, Doctor, Detective, Civilian } = t.sockets;
    const all = [Mafia, Doctor, Detective, Civilian];
    try {
      Mafia.emit("set-timer-settings", { dayDiscussionSec: 30, dayVoteSec: 15, nightStepSec: 15 });
      Mafia.emit("start-game");
      await waitFor(Mafia, "game-phase", (d) => d.phase === "night-mafia");
      clearEvents(...all);

      // Town can't talk at night; the Mafia's messages reach only the Mafia.
      Doctor.emit("send-chat", { text: "anyone awake?" });
      assert.match((await waitFor(Doctor, "room-error")).message, /asleep/i);
      Mafia.emit("send-chat", { text: "tonight we strike" });
      const plotted = await waitFor(Mafia, "chat-message");
      assert.equal(plotted.channel, "mafia");
      await sleep(300);
      for (const s of [Doctor, Detective, Civilian]) assert.equal(received(s, "chat-message").length, 0, "town read Mafia chat");

      // Mafia kills the Civilian; Doctor saves themself; Detective checks the Mafia.
      Mafia.emit("night-vote", { targetId: Civilian.id });
      // When the Mafia's turn ends, everyone (not just the Mafia) is told to play the shot.
      for (const s of all) {
        const doctorTurn = await waitFor(s, "game-phase", (d) => d.phase === "night-doctor");
        assert.equal(doctorTurn.shot, true);
      }
      Doctor.emit("doctor-protect", { targetId: Doctor.id });
      await waitFor(Detective, "game-phase", (d) => d.phase === "night-detective");
      Detective.emit("detective-investigate", { targetId: Mafia.id });
      const summary = await waitFor(Civilian, "night-summary");
      assert.equal(summary.attacked, true);
      assert.equal(summary.victimName, "Civilian");
      assert.ok(summary.lines.some((l) => l.includes("Civilian")));

      // The dead Civilian talks in ghost chat; the living don't see it.
      clearEvents(...all);
      Civilian.emit("send-chat", { text: "it was the Mafia!" });
      const ghost = await waitFor(Civilian, "chat-message");
      assert.equal(ghost.channel, "ghost");
      await sleep(300);
      for (const s of [Mafia, Doctor, Detective]) assert.equal(received(s, "chat-message").length, 0, "the living read ghost chat");

      // Day vote: Mafia skips, the other two vote the Mafia out.
      await waitFor(Mafia, "game-phase", (d) => d.phase === "day-vote", 70000);
      Mafia.emit("day-vote", { targetId: "skip" });
      await waitFor(Doctor, "day-vote-update", (d) => d.votes.skip === 1);
      Doctor.emit("day-vote", { targetId: Mafia.id });
      Detective.emit("day-vote", { targetId: Mafia.id });
      const result = await waitFor(Doctor, "day-result");
      assert.equal(result.eliminatedName, "Mafia");
      // Totals only: nobody learns who voted for whom.
      assert.deepEqual(result.tally, [{ target: "Mafia", votes: 2 }, { target: "skip", votes: 1 }]);
      assert.ok(result.tally.every((row) => !("voter" in row)), "voter names are never sent");

      // The Mafia are gone: town wins, and each player's profile tells their story.
      await waitFor(Doctor, "game-over");
      await sleep(300);
      const profile = async (who) => {
        const res = await fetch(`${server.base}/api/profile/me`, { headers: { authorization: `Bearer ${t.tokens[who]}` } });
        assert.equal(res.status, 200);
        return res.json();
      };
      const det = await profile("Detective");
      assert.equal(det.recent[0].result, "won");
      assert.equal(det.recent[0].outcome, "survived");
      assert.equal(det.best.role, "detective");
      assert.match(det.best.highlight, /caught the Mafia/);
      const civ = await profile("Civilian");
      assert.equal(civ.recent[0].outcome, "killed night 1");
      assert.equal(civ.recent[0].result, "won");
      const maf = await profile("Mafia");
      assert.equal(maf.recent[0].outcome, "voted out day 1");
      assert.equal(maf.recent[0].result, "lost");
    } finally {
      t.closeAll();
    }
  });
});

describe("profile", () => {
  test("needs a login, and a new player starts empty", async () => {
    assert.equal((await fetch(`${server.base}/api/profile/me`)).status, 401);
    const res = await fetch(`${server.base}/api/auth/signup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Newbie", email: `newbie.${Date.now()}@example.test`, password: "correct-horse-1", dob: "1990-01-01" }),
    });
    const { token } = await res.json();
    const me = await (await fetch(`${server.base}/api/profile/me`, { headers: { authorization: `Bearer ${token}` } })).json();
    assert.equal(me.name, "Newbie");
    assert.equal(me.totals.games, 0);
    assert.equal(me.best, null);
    assert.deepEqual(me.recent, []);
  });
});
