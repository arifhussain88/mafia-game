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

  test("night chat is Mafia-only, the dead get a ghost channel, and the vote tally is public", async () => {
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
      await waitFor(Doctor, "game-phase", (d) => d.phase === "night-doctor");
      // No sound reaches anyone when the Mafia pick (it used to tip off the town).
      for (const s of all) assert.equal(received(s, "mafia-kill-sound").length, 0);
      Doctor.emit("doctor-protect", { targetId: Doctor.id });
      await waitFor(Detective, "game-phase", (d) => d.phase === "night-detective");
      Detective.emit("detective-investigate", { targetId: Mafia.id });
      const summary = await waitFor(Civilian, "night-summary");
      assert.equal(summary.attacked, true);
      assert.equal(summary.victimName, "Civilian", "report names the victim so the gunshot lands on it");
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
      const byVoter = Object.fromEntries(result.tally.map((e) => [e.voter, e.target]));
      assert.deepEqual(byVoter, { Mafia: "skip", Doctor: "Mafia", Detective: "Mafia" });
      assert.ok(!("Civilian" in byVoter), "the dead don't appear in the tally");
    } finally {
      t.closeAll();
    }
  });
});
