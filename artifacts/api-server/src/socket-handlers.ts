import { Server, Socket } from "socket.io";
import { logger } from "./lib/logger";

const TIMERS = {
  ROLE_REVEAL: 6000,
  NIGHT: 30000,
  NIGHT_RESULT: 5000,
  DAY_DISCUSSION: 60000,
  DAY_VOTE: 30000,
  DAY_RESULT: 5000,
};

type Role = "mafia" | "civilian";
type Phase =
  | "lobby"
  | "role-reveal"
  | "night"
  | "night-result"
  | "day-discussion"
  | "day-vote"
  | "day-result"
  | "game-over";

interface Player {
  id: string;
  name: string;
  isHost: boolean;
  alive: boolean;
  role: Role | null;
}

interface Room {
  code: string;
  players: Map<string, Player>;
  phase: Phase;
  nightVotes: Map<string, string>;
  dayVotes: Map<string, string>;
  timer?: ReturnType<typeof setTimeout>;
  timerEndsAt: number;
}

const rooms = new Map<string, Room>();

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function serializePlayers(players: Map<string, Player>, revealRoles = false) {
  return Array.from(players.values()).map((p) => ({
    id: p.id,
    name: p.name,
    isHost: p.isHost,
    alive: p.alive,
    ...(revealRoles ? { role: p.role } : {}),
  }));
}

function living(room: Room) {
  return Array.from(room.players.values()).filter((p) => p.alive);
}

function livingMafia(room: Room) {
  return living(room).filter((p) => p.role === "mafia");
}

function livingCivilians(room: Room) {
  return living(room).filter((p) => p.role === "civilian");
}

function checkWin(room: Room): "mafia" | "civilians" | null {
  const mafiaAlive = livingMafia(room).length;
  const civAlive = livingCivilians(room).length;
  if (mafiaAlive === 0) return "civilians";
  if (mafiaAlive >= civAlive) return "mafia";
  return null;
}

function clearRoomTimer(room: Room) {
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = undefined;
  }
}

function startRoleReveal(io: Server, code: string) {
  const room = rooms.get(code);
  if (!room) return;

  room.phase = "role-reveal";

  const playerList = Array.from(room.players.values());
  const n = playerList.length;
  const mafiaCount = n >= 7 ? 2 : 1;
  const shuffled = [...playerList].sort(() => Math.random() - 0.5);
  shuffled.forEach((p, i) => {
    p.role = i < mafiaCount ? "mafia" : "civilian";
    p.alive = true;
  });

  const allMafiaNames = shuffled.filter((p) => p.role === "mafia").map((p) => p.name);
  const allMafiaIds = shuffled.filter((p) => p.role === "mafia").map((p) => p.id);

  for (const player of room.players.values()) {
    io.to(player.id).emit("role-assigned", {
      role: player.role,
      mafiaNames: player.role === "mafia" ? allMafiaNames : [],
      mafiaIds: player.role === "mafia" ? allMafiaIds : [],
    });
  }

  const endsAt = Date.now() + TIMERS.ROLE_REVEAL;
  room.timerEndsAt = endsAt;

  io.to(code).emit("game-phase", {
    phase: "role-reveal",
    endsAt,
    players: serializePlayers(room.players),
  });

  room.timer = setTimeout(() => startNight(io, code), TIMERS.ROLE_REVEAL);
  logger.info({ code, mafiaCount, n }, "Roles assigned, role-reveal started");
}

function startNight(io: Server, code: string) {
  const room = rooms.get(code);
  if (!room) return;

  clearRoomTimer(room);
  room.phase = "night";
  room.nightVotes = new Map();

  const endsAt = Date.now() + TIMERS.NIGHT;
  room.timerEndsAt = endsAt;

  io.to(code).emit("game-phase", {
    phase: "night",
    endsAt,
    players: serializePlayers(room.players),
  });

  broadcastNightVoteStatus(io, code);

  room.timer = setTimeout(() => resolveNight(io, code), TIMERS.NIGHT);
  logger.info({ code }, "Night phase started");
}

function broadcastNightVoteStatus(io: Server, code: string) {
  const room = rooms.get(code);
  if (!room) return;
  const total = livingMafia(room).length;
  const voted = room.nightVotes.size;
  io.to(code).emit("night-vote-status", { voted, total });
}

function resolveNight(io: Server, code: string) {
  const room = rooms.get(code);
  if (!room || room.phase !== "night") return;

  clearRoomTimer(room);
  room.phase = "night-result";

  const voteCounts = new Map<string, number>();
  for (const targetId of room.nightVotes.values()) {
    voteCounts.set(targetId, (voteCounts.get(targetId) ?? 0) + 1);
  }

  let eliminatedId: string | null = null;

  if (voteCounts.size > 0) {
    const maxVotes = Math.max(...voteCounts.values());
    const topTargets = Array.from(voteCounts.entries())
      .filter(([, c]) => c === maxVotes)
      .map(([id]) => id);
    eliminatedId = topTargets[Math.floor(Math.random() * topTargets.length)];
  } else {
    const civs = livingCivilians(room);
    if (civs.length > 0) {
      eliminatedId = civs[Math.floor(Math.random() * civs.length)].id;
    }
  }

  let eliminatedName = "";
  let eliminatedRole: Role = "civilian";

  if (eliminatedId) {
    const target = room.players.get(eliminatedId);
    if (target) {
      target.alive = false;
      eliminatedName = target.name;
      eliminatedRole = target.role!;
    }
  }

  io.to(code).emit("night-result", {
    eliminatedId,
    eliminatedName,
    eliminatedRole,
    players: serializePlayers(room.players),
  });

  logger.info({ code, eliminatedName, eliminatedRole }, "Night resolved");

  room.timer = setTimeout(() => {
    const winner = checkWin(room);
    if (winner) endGame(io, code, winner);
    else startDayDiscussion(io, code);
  }, TIMERS.NIGHT_RESULT);
}

function startDayDiscussion(io: Server, code: string) {
  const room = rooms.get(code);
  if (!room) return;

  clearRoomTimer(room);
  room.phase = "day-discussion";

  const endsAt = Date.now() + TIMERS.DAY_DISCUSSION;
  room.timerEndsAt = endsAt;

  io.to(code).emit("game-phase", {
    phase: "day-discussion",
    endsAt,
    players: serializePlayers(room.players),
  });

  room.timer = setTimeout(() => startDayVote(io, code), TIMERS.DAY_DISCUSSION);
  logger.info({ code }, "Day discussion started");
}

function startDayVote(io: Server, code: string) {
  const room = rooms.get(code);
  if (!room) return;

  clearRoomTimer(room);
  room.phase = "day-vote";
  room.dayVotes = new Map();

  const endsAt = Date.now() + TIMERS.DAY_VOTE;
  room.timerEndsAt = endsAt;

  io.to(code).emit("game-phase", {
    phase: "day-vote",
    endsAt,
    players: serializePlayers(room.players),
    votes: {},
  });

  room.timer = setTimeout(() => resolveDay(io, code), TIMERS.DAY_VOTE);
  logger.info({ code }, "Day vote started");
}

function resolveDay(io: Server, code: string) {
  const room = rooms.get(code);
  if (!room || room.phase !== "day-vote") return;

  clearRoomTimer(room);
  room.phase = "day-result";

  const voteCounts = new Map<string, number>();
  for (const targetId of room.dayVotes.values()) {
    voteCounts.set(targetId, (voteCounts.get(targetId) ?? 0) + 1);
  }

  let eliminatedId: string | null = null;
  let skipped = false;

  if (voteCounts.size === 0) {
    skipped = true;
  } else {
    const maxVotes = Math.max(...voteCounts.values());
    const topTargets = Array.from(voteCounts.entries())
      .filter(([, c]) => c === maxVotes)
      .map(([id]) => id);
    eliminatedId = topTargets[Math.floor(Math.random() * topTargets.length)];
  }

  let eliminatedName: string | null = null;
  let eliminatedRole: Role | null = null;

  if (eliminatedId) {
    const target = room.players.get(eliminatedId);
    if (target) {
      target.alive = false;
      eliminatedName = target.name;
      eliminatedRole = target.role!;
    }
  }

  io.to(code).emit("day-result", {
    eliminatedId,
    eliminatedName,
    eliminatedRole,
    skipped,
    players: serializePlayers(room.players),
  });

  logger.info({ code, eliminatedName, skipped }, "Day resolved");

  room.timer = setTimeout(() => {
    const winner = checkWin(room);
    if (winner) endGame(io, code, winner);
    else startNight(io, code);
  }, TIMERS.DAY_RESULT);
}

function endGame(io: Server, code: string, winner: "mafia" | "civilians") {
  const room = rooms.get(code);
  if (!room) return;

  clearRoomTimer(room);
  room.phase = "game-over";

  io.to(code).emit("game-over", {
    winner,
    players: serializePlayers(room.players, true),
  });

  logger.info({ code, winner }, "Game over");
}

function removePlayerFromRooms(socketId: string, io: Server) {
  for (const [code, room] of rooms.entries()) {
    if (!room.players.has(socketId)) continue;

    const player = room.players.get(socketId)!;
    const wasHost = player.isHost;

    if (room.phase === "lobby") {
      room.players.delete(socketId);
      if (room.players.size === 0) {
        rooms.delete(code);
        return;
      }
      if (wasHost) {
        const next = room.players.values().next().value!;
        next.isHost = true;
      }
      io.to(code).emit("players-updated", { players: serializePlayers(room.players) });
    } else {
      player.alive = false;
      room.nightVotes.delete(socketId);
      room.dayVotes.delete(socketId);

      const winner = room.phase !== "game-over" ? checkWin(room) : null;
      if (winner && room.phase !== "night-result" && room.phase !== "day-result" && room.phase !== "game-over") {
        clearRoomTimer(room);
        endGame(io, code, winner);
      } else {
        io.to(code).emit("players-updated", { players: serializePlayers(room.players) });

        if (room.phase === "night") {
          const mafiaTotal = livingMafia(room).length;
          const mafiaVoted = Array.from(room.nightVotes.keys()).filter((id) => {
            const p = room.players.get(id);
            return p && p.alive && p.role === "mafia";
          }).length;

          broadcastNightVoteStatus(io, code);

          if (mafiaTotal > 0 && mafiaVoted >= mafiaTotal) {
            resolveNight(io, code);
          }
        }
      }
    }

    logger.info({ code, socketId }, "Player disconnected from room");
    return;
  }
}

export function registerSocketHandlers(io: Server) {
  io.on("connection", (socket: Socket) => {
    logger.info({ socketId: socket.id }, "Socket connected");

    socket.on("create-room", (data: { name: string }) => {
      const name = (data?.name ?? "").trim();
      if (!name) { socket.emit("room-error", { message: "Display name is required" }); return; }

      let code = generateCode();
      while (rooms.has(code)) code = generateCode();

      const player: Player = { id: socket.id, name, isHost: true, alive: true, role: null };
      const room: Room = {
        code,
        players: new Map([[socket.id, player]]),
        phase: "lobby",
        nightVotes: new Map(),
        dayVotes: new Map(),
        timerEndsAt: 0,
      };
      rooms.set(code, room);
      socket.join(code);

      socket.emit("room-created", { code, players: serializePlayers(room.players), isHost: true });
      logger.info({ code, name }, "Room created");
    });

    socket.on("join-room", (data: { code: string; name: string }) => {
      const code = (data?.code ?? "").trim().toUpperCase();
      const name = (data?.name ?? "").trim();

      if (!code) { socket.emit("room-error", { message: "Room code is required" }); return; }
      if (!name) { socket.emit("room-error", { message: "Display name is required" }); return; }

      const room = rooms.get(code);
      if (!room) { socket.emit("room-error", { message: "Room not found. Check your code." }); return; }
      if (room.phase !== "lobby") { socket.emit("room-error", { message: "This game has already started." }); return; }

      const nameTaken = Array.from(room.players.values()).some(
        (p) => p.name.toLowerCase() === name.toLowerCase(),
      );
      if (nameTaken) { socket.emit("room-error", { message: "That name is already taken in this room." }); return; }

      const player: Player = { id: socket.id, name, isHost: false, alive: true, role: null };
      room.players.set(socket.id, player);
      socket.join(code);

      socket.emit("room-joined", { code, players: serializePlayers(room.players), isHost: false });
      socket.to(code).emit("players-updated", { players: serializePlayers(room.players) });
      logger.info({ code, name }, "Player joined room");
    });

    socket.on("start-game", () => {
      for (const [code, room] of rooms.entries()) {
        const player = room.players.get(socket.id);
        if (!player) continue;

        if (!player.isHost) { socket.emit("room-error", { message: "Only the host can start the game." }); return; }
        if (room.players.size < 4) { socket.emit("room-error", { message: "Need at least 4 players to start." }); return; }
        if (room.phase !== "lobby") return;

        startRoleReveal(io, code);
        return;
      }
    });

    socket.on("night-vote", (data: { targetId: string }) => {
      for (const [code, room] of rooms.entries()) {
        const voter = room.players.get(socket.id);
        if (!voter) continue;

        if (room.phase !== "night") return;
        if (!voter.alive || voter.role !== "mafia") return;

        const target = room.players.get(data.targetId);
        if (!target || !target.alive || target.role === "mafia") return;

        room.nightVotes.set(socket.id, data.targetId);
        broadcastNightVoteStatus(io, code);

        const mafiaAlive = livingMafia(room);
        const allVoted = mafiaAlive.every((m) => room.nightVotes.has(m.id));
        if (allVoted) resolveNight(io, code);

        return;
      }
    });

    socket.on("day-vote", (data: { targetId: string }) => {
      for (const [code, room] of rooms.entries()) {
        const voter = room.players.get(socket.id);
        if (!voter) continue;

        if (room.phase !== "day-vote") return;
        if (!voter.alive) return;
        if (data.targetId === socket.id) return;

        const target = room.players.get(data.targetId);
        if (!target || !target.alive) return;

        room.dayVotes.set(socket.id, data.targetId);

        const voteCounts: Record<string, number> = {};
        for (const targetId of room.dayVotes.values()) {
          voteCounts[targetId] = (voteCounts[targetId] ?? 0) + 1;
        }
        io.to(code).emit("day-vote-update", { votes: voteCounts });

        const livingCount = living(room).length;
        const majority = Math.floor(livingCount / 2) + 1;
        const maxVotes = Math.max(...Object.values(voteCounts));
        if (maxVotes >= majority) resolveDay(io, code);

        return;
      }
    });

    socket.on("disconnect", () => {
      removePlayerFromRooms(socket.id, io);
      logger.info({ socketId: socket.id }, "Socket disconnected");
    });
  });
}
