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

const MIN_PLAYERS = 5;

type Role = "mafia" | "civilian" | "doctor" | "detective";
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
  connected: boolean;
  role: Role | null;
}

interface DetectiveResult {
  detectiveId: string;
  targetName: string;
  isMafia: boolean;
}

interface Room {
  code: string;
  players: Map<string, Player>;
  phase: Phase;
  nightVotes: Map<string, string>;
  dayVotes: Map<string, string>;
  doctorProtect: Map<string, string>;
  detectiveInvestigate: Map<string, string>;
  timer?: ReturnType<typeof setTimeout>;
  timerEndsAt: number;
  pendingNarration: string;
  pendingDetectiveResult: DetectiveResult | null;
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
    connected: p.connected,
    ...(revealRoles ? { role: p.role } : {}),
  }));
}

function living(room: Room) {
  return Array.from(room.players.values()).filter((p) => p.alive);
}

function livingMafia(room: Room) {
  return living(room).filter((p) => p.role === "mafia");
}

function livingTown(room: Room) {
  return living(room).filter((p) => p.role !== "mafia");
}

function connectedLivingMafia(room: Room) {
  return livingMafia(room).filter((p) => p.connected);
}

function checkWin(room: Room): "mafia" | "civilians" | null {
  const mafiaAlive = livingMafia(room).length;
  const townAlive = livingTown(room).length;
  if (mafiaAlive === 0) return "civilians";
  if (mafiaAlive >= townAlive) return "mafia";
  return null;
}

function clearRoomTimer(room: Room) {
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = undefined;
  }
}

function getMafiaInfo(room: Room) {
  const mafia = Array.from(room.players.values()).filter((p) => p.role === "mafia");
  return {
    mafiaNames: mafia.map((p) => p.name),
    mafiaIds: mafia.map((p) => p.id),
  };
}

function assignRoles(room: Room) {
  const playerList = Array.from(room.players.values());
  const n = playerList.length;
  const mafiaCount = n >= 7 ? 2 : 1;
  const shuffled = [...playerList].sort(() => Math.random() - 0.5);
  shuffled.forEach((p, i) => {
    p.alive = true;
    p.connected = true;
    if (i < mafiaCount) p.role = "mafia";
    else if (i === mafiaCount) p.role = "doctor";
    else if (i === mafiaCount + 1) p.role = "detective";
    else p.role = "civilian";
  });
}

function startRoleReveal(io: Server, code: string) {
  const room = rooms.get(code);
  if (!room) return;

  room.phase = "role-reveal";
  assignRoles(room);

  const { mafiaNames, mafiaIds } = getMafiaInfo(room);

  for (const player of room.players.values()) {
    io.to(player.id).emit("role-assigned", {
      role: player.role,
      mafiaNames: player.role === "mafia" ? mafiaNames : [],
      mafiaIds: player.role === "mafia" ? mafiaIds : [],
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
  logger.info({ code, n: room.players.size }, "Roles assigned, role-reveal started");
}

function startNight(io: Server, code: string) {
  const room = rooms.get(code);
  if (!room) return;

  clearRoomTimer(room);
  room.phase = "night";
  room.nightVotes = new Map();
  room.doctorProtect = new Map();
  room.detectiveInvestigate = new Map();

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
  const total = connectedLivingMafia(room).length;
  const voted = room.nightVotes.size;
  io.to(code).emit("night-vote-status", { voted, total });
}

function resolveNight(io: Server, code: string) {
  const room = rooms.get(code);
  if (!room || room.phase !== "night") return;

  clearRoomTimer(room);
  room.phase = "night-result";

  // Determine mafia's chosen target
  const voteCounts = new Map<string, number>();
  for (const targetId of room.nightVotes.values()) {
    voteCounts.set(targetId, (voteCounts.get(targetId) ?? 0) + 1);
  }

  let mafiaTargetId: string | null = null;
  if (voteCounts.size > 0) {
    const maxVotes = Math.max(...voteCounts.values());
    const topTargets = Array.from(voteCounts.entries())
      .filter(([, c]) => c === maxVotes)
      .map(([id]) => id);
    mafiaTargetId = topTargets[Math.floor(Math.random() * topTargets.length)];
  } else {
    const nonMafia = livingTown(room);
    if (nonMafia.length > 0) {
      mafiaTargetId = nonMafia[Math.floor(Math.random() * nonMafia.length)].id;
    }
  }

  // Doctor protection
  const doctorProtectedId = Array.from(room.doctorProtect.values())[0] ?? null;
  const wasProtected = mafiaTargetId !== null && doctorProtectedId === mafiaTargetId;

  let eliminatedId: string | null = wasProtected ? null : mafiaTargetId;
  let eliminatedName: string | null = null;
  let eliminatedRole: Role | null = null;
  let protectedName: string | null = null;

  if (eliminatedId) {
    const target = room.players.get(eliminatedId);
    if (target) {
      target.alive = false;
      eliminatedName = target.name;
      eliminatedRole = target.role;
    }
  }

  if (wasProtected && mafiaTargetId) {
    const prot = room.players.get(mafiaTargetId);
    if (prot) protectedName = prot.name;
  }

  // Build public narration — no roles revealed
  let narration: string;
  if (protectedName) {
    narration = `${protectedName} was attacked last night but survived until morning.`;
  } else if (eliminatedName) {
    narration = `${eliminatedName} was found dead this morning.`;
  } else {
    narration = "It was a quiet night. No one was harmed.";
  }
  room.pendingNarration = narration;

  // Prepare detective result
  room.pendingDetectiveResult = null;
  for (const [detectiveId, targetId] of room.detectiveInvestigate.entries()) {
    const detective = room.players.get(detectiveId);
    if (!detective || !detective.alive) continue;
    const investigated = room.players.get(targetId);
    if (investigated) {
      room.pendingDetectiveResult = {
        detectiveId,
        targetName: investigated.name,
        isMafia: investigated.role === "mafia",
      };
    }
    break;
  }

  io.to(code).emit("night-result", {
    eliminatedId,
    eliminatedName,
    eliminatedRole,
    players: serializePlayers(room.players),
  });

  logger.info({ code, eliminatedName, wasProtected }, "Night resolved");

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

  const narration = room.pendingNarration;
  room.pendingNarration = "";

  io.to(code).emit("game-phase", {
    phase: "day-discussion",
    endsAt,
    players: serializePlayers(room.players),
    narration,
  });

  // Send detective result privately
  if (room.pendingDetectiveResult) {
    const { detectiveId, targetName, isMafia } = room.pendingDetectiveResult;
    const detective = room.players.get(detectiveId);
    if (detective && detective.alive) {
      io.to(detectiveId).emit("detective-result", { targetName, isMafia });
      logger.info({ code, detectiveId, targetName, isMafia }, "Detective result sent");
    }
    room.pendingDetectiveResult = null;
  }

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
      eliminatedRole = target.role;
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

function handleMidGameDisconnect(socketId: string, room: Room, io: Server, code: string) {
  const player = room.players.get(socketId);
  if (!player) return;

  player.connected = false;
  room.nightVotes.delete(socketId);
  room.dayVotes.delete(socketId);
  room.doctorProtect.delete(socketId);
  room.detectiveInvestigate.delete(socketId);

  io.to(code).emit("players-updated", { players: serializePlayers(room.players) });

  if (room.phase === "night") {
    broadcastNightVoteStatus(io, code);
    const mafiaAlive = connectedLivingMafia(room);
    const allVoted = mafiaAlive.length > 0 && mafiaAlive.every((m) => room.nightVotes.has(m.id));
    if (allVoted) resolveNight(io, code);
  }

  const winner = checkWin(room);
  if (
    winner &&
    room.phase !== "night-result" &&
    room.phase !== "day-result" &&
    room.phase !== "game-over"
  ) {
    clearRoomTimer(room);
    endGame(io, code, winner);
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

      const player: Player = { id: socket.id, name, isHost: true, alive: true, connected: true, role: null };
      const room: Room = {
        code,
        players: new Map([[socket.id, player]]),
        phase: "lobby",
        nightVotes: new Map(),
        dayVotes: new Map(),
        doctorProtect: new Map(),
        detectiveInvestigate: new Map(),
        timerEndsAt: 0,
        pendingNarration: "",
        pendingDetectiveResult: null,
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

      if (room.phase !== "lobby") {
        const disconnected = Array.from(room.players.values()).find(
          (p) => !p.connected && p.name.toLowerCase() === name.toLowerCase(),
        );

        if (!disconnected) {
          socket.emit("room-error", { message: "This game has already started." });
          return;
        }

        room.players.delete(disconnected.id);
        disconnected.id = socket.id;
        disconnected.connected = true;
        room.players.set(socket.id, disconnected);
        socket.join(code);

        const { mafiaNames, mafiaIds } = getMafiaInfo(room);

        socket.emit("reconnected", {
          code,
          phase: room.phase,
          endsAt: room.timerEndsAt,
          players: serializePlayers(room.players),
          isHost: disconnected.isHost,
        });

        socket.emit("role-assigned", {
          role: disconnected.role,
          mafiaNames: disconnected.role === "mafia" ? mafiaNames : [],
          mafiaIds: disconnected.role === "mafia" ? mafiaIds : [],
        });

        socket.to(code).emit("players-updated", { players: serializePlayers(room.players) });
        logger.info({ code, name }, "Player reconnected");
        return;
      }

      const nameTaken = Array.from(room.players.values()).some(
        (p) => p.name.toLowerCase() === name.toLowerCase(),
      );
      if (nameTaken) { socket.emit("room-error", { message: "That name is already taken in this room." }); return; }

      const player: Player = { id: socket.id, name, isHost: false, alive: true, connected: true, role: null };
      room.players.set(socket.id, player);
      socket.join(code);

      socket.emit("room-joined", { code, players: serializePlayers(room.players), isHost: false });
      socket.to(code).emit("players-updated", { players: serializePlayers(room.players) });
      logger.info({ code, name }, "Player joined room");
    });

    socket.on("kick-player", (data: { targetId: string }) => {
      for (const [code, room] of rooms.entries()) {
        const kicker = room.players.get(socket.id);
        if (!kicker) continue;
        if (!kicker.isHost || room.phase !== "lobby") return;

        const target = room.players.get(data.targetId);
        if (!target || target.id === socket.id) return;

        room.players.delete(data.targetId);
        io.to(data.targetId).emit("kicked");
        io.to(code).emit("players-updated", { players: serializePlayers(room.players) });
        logger.info({ code, kickedName: target.name }, "Player kicked");
        return;
      }
    });

    socket.on("start-game", () => {
      for (const [code, room] of rooms.entries()) {
        const player = room.players.get(socket.id);
        if (!player) continue;
        if (!player.isHost) { socket.emit("room-error", { message: "Only the host can start the game." }); return; }
        if (room.players.size < MIN_PLAYERS) {
          socket.emit("room-error", { message: `Need at least ${MIN_PLAYERS} players to start.` });
          return;
        }
        if (room.phase !== "lobby") return;
        startRoleReveal(io, code);
        return;
      }
    });

    socket.on("play-again", () => {
      for (const [code, room] of rooms.entries()) {
        const player = room.players.get(socket.id);
        if (!player) continue;
        if (!player.isHost || room.phase !== "game-over") return;

        clearRoomTimer(room);
        room.phase = "lobby";
        room.nightVotes = new Map();
        room.dayVotes = new Map();
        room.doctorProtect = new Map();
        room.detectiveInvestigate = new Map();
        room.timerEndsAt = 0;
        room.pendingNarration = "";
        room.pendingDetectiveResult = null;

        for (const [id, p] of room.players.entries()) {
          if (!p.connected) room.players.delete(id);
          else { p.alive = true; p.role = null; }
        }

        io.to(code).emit("room-reset", { players: serializePlayers(room.players) });
        logger.info({ code }, "Room reset for play again");
        return;
      }
    });

    socket.on("night-vote", (data: { targetId: string }) => {
      for (const [code, room] of rooms.entries()) {
        const voter = room.players.get(socket.id);
        if (!voter) continue;
        if (room.phase !== "night" || !voter.alive || voter.role !== "mafia") return;

        const target = room.players.get(data.targetId);
        if (!target || !target.alive || target.role === "mafia") return;

        room.nightVotes.set(socket.id, data.targetId);
        broadcastNightVoteStatus(io, code);

        const connectedMafia = connectedLivingMafia(room);
        const allVoted = connectedMafia.length > 0 && connectedMafia.every((m) => room.nightVotes.has(m.id));
        if (allVoted) resolveNight(io, code);
        return;
      }
    });

    socket.on("doctor-protect", (data: { targetId: string }) => {
      for (const [, room] of rooms.entries()) {
        const doctor = room.players.get(socket.id);
        if (!doctor) continue;
        if (room.phase !== "night" || !doctor.alive || doctor.role !== "doctor") return;

        const target = room.players.get(data.targetId);
        if (!target || !target.alive) return;

        room.doctorProtect.set(socket.id, data.targetId);
        // private confirmation only
        socket.emit("doctor-protect-ack", { targetId: data.targetId });
        return;
      }
    });

    socket.on("detective-investigate", (data: { targetId: string }) => {
      for (const [, room] of rooms.entries()) {
        const detective = room.players.get(socket.id);
        if (!detective) continue;
        if (room.phase !== "night" || !detective.alive || detective.role !== "detective") return;

        const target = room.players.get(data.targetId);
        if (!target || !target.alive || target.id === socket.id) return;

        room.detectiveInvestigate.set(socket.id, data.targetId);
        socket.emit("detective-investigate-ack", { targetId: data.targetId });
        return;
      }
    });

    socket.on("day-vote", (data: { targetId: string }) => {
      for (const [code, room] of rooms.entries()) {
        const voter = room.players.get(socket.id);
        if (!voter) continue;
        if (room.phase !== "day-vote" || !voter.alive || data.targetId === socket.id) return;

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
      for (const [code, room] of rooms.entries()) {
        if (!room.players.has(socket.id)) continue;

        if (room.phase === "lobby") {
          const player = room.players.get(socket.id)!;
          const wasHost = player.isHost;
          room.players.delete(socket.id);

          if (room.players.size === 0) { rooms.delete(code); }
          else {
            if (wasHost) {
              const next = room.players.values().next().value!;
              next.isHost = true;
            }
            io.to(code).emit("players-updated", { players: serializePlayers(room.players) });
          }
        } else if (room.phase !== "game-over") {
          handleMidGameDisconnect(socket.id, room, io, code);
        }

        logger.info({ socketId: socket.id, code }, "Player disconnected");
        return;
      }
      logger.info({ socketId: socket.id }, "Socket disconnected (no room)");
    });
  });
}
