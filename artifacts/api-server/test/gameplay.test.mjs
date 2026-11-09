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
