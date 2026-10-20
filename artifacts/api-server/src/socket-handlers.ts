import { Server, Socket } from "socket.io";
import { logger } from "./lib/logger";
import { getUserForToken } from "./lib/user-store";


const TIMERS = {
  MATCH_COUNTDOWN: 5000,
  ROLE_REVEAL: 6000,
  NIGHT_STEP: 60000,
  NIGHT_EARLY_ADVANCE: 2000,
  /** Extra beat after detective flip so the card animation can finish. */
  DETECTIVE_REVEAL_PAUSE: 2800,
  DAY_DISCUSSION: 60000,
  DAY_VOTE: 30000,
  DAY_RESULT: 5000,
  /** Delay before an intentional leave becomes a permanent forfeit. */
  FORFEIT_GRACE: 15000,
};

/** Per-room host overrides (seconds). Applied to night step / day discussion / day vote. */
type TimerSettings = {
  nightStepSec: number;
  dayDiscussionSec: number;
  dayVoteSec: number;
};

const DEFAULT_TIMER_SETTINGS: TimerSettings = {
  nightStepSec: 60,
  dayDiscussionSec: 60,
  dayVoteSec: 30,
};

const TIMER_CLAMPS = {
  nightStepSec: { min: 15, max: 90 },
  dayDiscussionSec: { min: 30, max: 180 },
  dayVoteSec: { min: 15, max: 90 },
} as const;

function clampSec(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function normalizeTimerSettings(raw: Partial<TimerSettings> | null | undefined): TimerSettings {
  return {
    nightStepSec: clampSec(
      raw?.nightStepSec,
      TIMER_CLAMPS.nightStepSec.min,
      TIMER_CLAMPS.nightStepSec.max,
      DEFAULT_TIMER_SETTINGS.nightStepSec,
    ),
    dayDiscussionSec: clampSec(
      raw?.dayDiscussionSec,
      TIMER_CLAMPS.dayDiscussionSec.min,
      TIMER_CLAMPS.dayDiscussionSec.max,
      DEFAULT_TIMER_SETTINGS.dayDiscussionSec,
    ),
    dayVoteSec: clampSec(
      raw?.dayVoteSec,
      TIMER_CLAMPS.dayVoteSec.min,
      TIMER_CLAMPS.dayVoteSec.max,
      DEFAULT_TIMER_SETTINGS.dayVoteSec,
    ),
  };
}

function nightStepMs(room: Room): number {
  return room.timerSettings.nightStepSec * 1000;
}

function dayDiscussionMs(room: Room): number {
  return room.timerSettings.dayDiscussionSec * 1000;
}

function dayVoteMs(room: Room): number {
  return room.timerSettings.dayVoteSec * 1000;
}

// Must match NightSummary.tsx animation constants (include START_DELAY_MS there)
const TYPEWRITER_CHAR_DELAY = 42;
const TYPEWRITER_LINE_PAUSE = 1000;
const TYPEWRITER_START_DELAY = 280;
const NIGHT_SUMMARY_EXTRA_PAUSE = 3000;

const MIN_PLAYERS = 3;
const MAX_PLAYERS_PER_ROOM = 12;
const MAX_OPEN_ROOMS = 20;
const MAX_SOCKETS_PER_IP = 8;
const CHAT_COOLDOWN_MS = 1500;
const EMPTY_LOBBY_TTL_MS = 5 * 60 * 1000;
const ROOM_GC_INTERVAL_MS = 60 * 1000;

const socketsByIp = new Map<string, Set<string>>();

type Role = "mafia" | "civilian" | "doctor" | "detective";
type Phase =
  | "lobby"
  | "match-countdown"
  | "role-reveal"
  | "night-mafia"
  | "night-doctor"
  | "night-detective"
  | "night-summary"
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

interface ChatMessage {
  id: string;
  name: string;
  text: string;
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
  chatMessages: ChatMessage[];
  chatReports: ChatMessage[];
  chatSeq: number;
  lastChatAt: Map<string, number>;
  emptySince?: number;
  timerSettings: TimerSettings;
  /** Lowercase display names that intentionally left; cannot soft-reconnect. */
  forfeitedNames: Set<string>;
  pendingForfeits: Map<string, ReturnType<typeof setTimeout>>;
}

const rooms = new Map<string, Room>();

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function serializePlayers(players: Map<string, Player>, revealRoles = false, viewerId?: string) {
  return Array.from(players.values()).map((p) => ({
    id: p.id,
    name: p.name,
    // Only the actual host sees who the host is; everyone else sees isHost: false for all players
    isHost: viewerId ? p.id === viewerId && p.isHost : false,
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

const FIXED_TEST_ROLES: Record<string, Role> = {
  Mafia: "mafia",
  Doctor: "doctor",
  Detective: "detective",
  Civilian: "civilian",
};

function assignRoles(room: Room) {
  const playerList = Array.from(room.players.values());
  const names = new Set(playerList.map((p) => p.name));
  const fixedNames = Object.keys(FIXED_TEST_ROLES);
  if (playerList.length === 4 && fixedNames.every((name) => names.has(name))) {
    for (const player of playerList) {
      player.alive = true;
      player.connected = true;
      player.role = FIXED_TEST_ROLES[player.name];
    }
    return;
  }

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

function clearDayChat(room: Room) {
  room.chatMessages = [];
  room.lastChatAt = new Map();
}

function clearPendingForfeits(room: Room) {
  for (const timer of room.pendingForfeits.values()) clearTimeout(timer);
  room.pendingForfeits.clear();
}

function emitPlayersUpdated(io: Server, code: string, room: Room) {
  for (const p of room.players.values()) {
    io.to(p.id).emit("players-updated", { players: serializePlayers(room.players, false, p.id) });
  }
}

function clearPlayerActions(room: Room, playerId: string) {
  room.nightVotes.delete(playerId);
  room.dayVotes.delete(playerId);
  room.doctorProtect.delete(playerId);
  room.detectiveInvestigate.delete(playerId);
  for (const [voterId, targetId] of Array.from(room.dayVotes.entries())) {
    if (targetId === playerId) room.dayVotes.delete(voterId);
  }
}

function transferHost(room: Room) {
  const hasHost = Array.from(room.players.values()).some((p) => p.isHost);
  if (hasHost) return;
  const next = room.players.values().next().value as Player | undefined;
  if (next) next.isHost = true;
}

function maybeAdvanceNightAfterAbsence(io: Server, code: string, room: Room) {
  if (room.phase === "night-mafia") {
    broadcastNightVoteStatus(io, code);
    const mafiaAlive = connectedLivingMafia(room);
    const allVoted = mafiaAlive.length === 0 || mafiaAlive.every((m) => room.nightVotes.has(m.id));
    if (allVoted) {
      clearRoomTimer(room);
      room.timer = setTimeout(() => startNightDoctor(io, code), TIMERS.NIGHT_EARLY_ADVANCE);
    }
    return;
  }

  if (room.phase === "night-doctor") {
    const doctorOnline = living(room).some((p) => p.role === "doctor" && p.connected);
    if (!doctorOnline) {
      clearRoomTimer(room);
      room.timer = setTimeout(() => startNightDetective(io, code), TIMERS.NIGHT_EARLY_ADVANCE);
    }
    return;
  }

  if (room.phase === "night-detective") {
    const detectiveOnline = living(room).some((p) => p.role === "detective" && p.connected);
    if (!detectiveOnline) {
      clearRoomTimer(room);
      room.timer = setTimeout(() => resolveNight(io, code), TIMERS.NIGHT_EARLY_ADVANCE);
    }
  }
}

function applyForfeit(io: Server, code: string, playerId: string) {
  const room = rooms.get(code);
  if (!room) return;
  room.pendingForfeits.delete(playerId);

  const player = room.players.get(playerId);
  if (!player) return;

  const name = player.name;
  const wasHost = player.isHost;
  player.alive = false;
  player.connected = false;
  player.isHost = false;
  clearPlayerActions(room, playerId);
  room.forfeitedNames.add(name.toLowerCase());

  if (wasHost) transferHost(room);

  io.to(code).emit("player-left", { name });
  emitPlayersUpdated(io, code, room);

  if (room.phase === "day-vote") {
    const voteCounts: Record<string, number> = {};
    for (const targetId of room.dayVotes.values()) {
      voteCounts[targetId] = (voteCounts[targetId] ?? 0) + 1;
    }
    io.to(code).emit("day-vote-update", { votes: voteCounts });
  }

  maybeAdvanceNightAfterAbsence(io, code, room);

  const winner = checkWin(room);
  if (
    winner &&
    room.phase !== "night-summary" &&
    room.phase !== "day-result" &&
    room.phase !== "game-over"
  ) {
    clearRoomTimer(room);
    endGame(io, code, winner);
  }

  logger.info({ code, name }, "Player forfeited after grace");
}

function emitChatMessage(io: Server, room: Room, message: ChatMessage) {
  for (const player of room.players.values()) {
    const target = io.sockets.sockets.get(player.id);
    if (!target) continue;
    const blocked = target.data.blockedNames as Set<string> | undefined;
    if (blocked?.has(message.name)) continue;
    target.emit("chat-message", message);
  }
}

function buildNightSummaryLines(
  mafiaTargetId: string | null,
  eliminatedName: string | null,
  wasProtected: boolean,
): string[] {
  if (!mafiaTargetId) {
    return ["The town slept peacefully. No one was harmed."];
  }

  const lines: string[] = [];
  if (wasProtected) {
    lines.push("The town stirred… someone was attacked in the night.");
    lines.push("But somehow, they survived the night.");
  } else {
    lines.push(`The town woke to find ${eliminatedName} dead in the streets.`);
    lines.push("The Doctor tried to save someone… but failed.");
  }
  lines.push("The Detective watches silently, taking notes.");
  return lines;
}

/** Compute how long the frontend typewriter will take to render all lines. */
function computeTypewriterDuration(lines: string[]): number {
  return (
    TYPEWRITER_START_DELAY +
    lines.reduce(
      (total, line) => total + line.length * TYPEWRITER_CHAR_DELAY + TYPEWRITER_LINE_PAUSE,
      0,
    )
  );
}

function broadcastNightVoteStatus(io: Server, code: string) {
  const room = rooms.get(code);
  if (!room || room.phase !== "night-mafia") return;
  const total = connectedLivingMafia(room).length;
  const voted = room.nightVotes.size;
  io.to(code).emit("night-vote-status", { voted, total });
}

function startMatchCountdown(io: Server, code: string) {
  const room = rooms.get(code);
  if (!room) return;

  clearRoomTimer(room);
  room.phase = "match-countdown";
  const endsAt = Date.now() + TIMERS.MATCH_COUNTDOWN;
  room.timerEndsAt = endsAt;

  io.to(code).emit("game-phase", {
    phase: "match-countdown",
    endsAt,
    players: serializePlayers(room.players),
  });

  room.timer = setTimeout(() => startRoleReveal(io, code), TIMERS.MATCH_COUNTDOWN);
  logger.info({ code, n: room.players.size }, "Match countdown started");
}

function startRoleReveal(io: Server, code: string) {
  const room = rooms.get(code);
  if (!room) return;

  clearRoomTimer(room);
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

  room.timer = setTimeout(() => startNightMafia(io, code), TIMERS.ROLE_REVEAL);
  logger.info({ code, n: room.players.size }, "Roles assigned, role-reveal started");
}

function startNightMafia(io: Server, code: string) {
  const room = rooms.get(code);
  if (!room) return;

  clearRoomTimer(room);
  room.phase = "night-mafia";
  room.nightVotes = new Map();
  room.doctorProtect = new Map();
  room.detectiveInvestigate = new Map();

  const connectedMafia = connectedLivingMafia(room);
  const duration = connectedMafia.length > 0 ? nightStepMs(room) : Math.floor(Math.random() * 3000) + 5000;

  const endsAt = Date.now() + duration;
  room.timerEndsAt = endsAt;

  io.to(code).emit("game-phase", {
    phase: "night-mafia",
    endsAt,
    players: serializePlayers(room.players),
  });

  broadcastNightVoteStatus(io, code);
  room.timer = setTimeout(() => startNightDoctor(io, code), duration);
  logger.info({ code }, "Night: Mafia phase started");
}

function startNightDoctor(io: Server, code: string) {
  const room = rooms.get(code);
  if (!room) return;

  clearRoomTimer(room);
  room.phase = "night-doctor";

  const doctor = Array.from(room.players.values()).find(p => p.role === "doctor" && p.alive && p.connected);
  const duration = doctor ? nightStepMs(room) : Math.floor(Math.random() * 3000) + 5000;

  const endsAt = Date.now() + duration;
  room.timerEndsAt = endsAt;

  io.to(code).emit("game-phase", {
    phase: "night-doctor",
    endsAt,
    players: serializePlayers(room.players),
  });

  room.timer = setTimeout(() => startNightDetective(io, code), duration);
  logger.info({ code }, "Night: Doctor phase started");
}

function startNightDetective(io: Server, code: string) {
  const room = rooms.get(code);
  if (!room) return;

  clearRoomTimer(room);
  room.phase = "night-detective";

  const detective = Array.from(room.players.values()).find(p => p.role === "detective" && p.alive && p.connected);
  const duration = detective ? nightStepMs(room) : Math.floor(Math.random() * 3000) + 5000;

  const endsAt = Date.now() + duration;
  room.timerEndsAt = endsAt;

  io.to(code).emit("game-phase", {
    phase: "night-detective",
    endsAt,
    players: serializePlayers(room.players),
  });

  room.timer = setTimeout(() => resolveNight(io, code), duration);
  logger.info({ code }, "Night: Detective phase started");
}

function resolveNight(io: Server, code: string) {
  const room = rooms.get(code);
  if (!room) return;
  if (
    room.phase !== "night-mafia" &&
    room.phase !== "night-doctor" &&
    room.phase !== "night-detective"
  ) return;

  clearRoomTimer(room);
  room.phase = "night-summary";

  // Determine mafia's chosen target (no fallback — no vote means no attack)
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
  }

  // Doctor protection
  const doctorProtectedId = Array.from(room.doctorProtect.values())[0] ?? null;
  const wasProtected = mafiaTargetId !== null && doctorProtectedId === mafiaTargetId;

  const eliminatedId: string | null = wasProtected ? null : mafiaTargetId;
  let eliminatedName: string | null = null;

  if (eliminatedId) {
    const target = room.players.get(eliminatedId);
    if (target) {
      target.alive = false;
      eliminatedName = target.name;
    }
  }

  // Store brief narration for day-discussion header
  if (eliminatedName) {
    room.pendingNarration = `${eliminatedName} was found dead this morning.`;
  } else if (wasProtected) {
    room.pendingNarration = "Someone was attacked last night but survived.";
  } else {
    room.pendingNarration = "It was a peaceful night.";
  }

  const lines = buildNightSummaryLines(mafiaTargetId, eliminatedName, wasProtected);

  // Auto-advance to day after typewriter finishes + 3s pause
  const typewriterMs = computeTypewriterDuration(lines);
  const summaryDelay = typewriterMs + NIGHT_SUMMARY_EXTRA_PAUSE;
  room.timerEndsAt = Date.now() + summaryDelay;

  io.to(code).emit("night-summary", {
    lines,
    eliminatedId,
    players: serializePlayers(room.players),
  });

  room.timer = setTimeout(() => {
    const roomNow = rooms.get(code);
    if (!roomNow || roomNow.phase !== "night-summary") return;
    const winner = checkWin(roomNow);
    if (winner) endGame(io, code, winner);
    else startDayDiscussion(io, code);
  }, summaryDelay);

  logger.info({ code, eliminatedName, wasProtected, summaryDelay }, "Night resolved — day begins automatically");
}

function startDayDiscussion(io: Server, code: string) {
  const room = rooms.get(code);
  if (!room) return;

  clearRoomTimer(room);
  room.phase = "day-discussion";

  const discussionMs = dayDiscussionMs(room);
  const endsAt = Date.now() + discussionMs;
  room.timerEndsAt = endsAt;

  const narration = room.pendingNarration;
  room.pendingNarration = "";

  io.to(code).emit("game-phase", {
    phase: "day-discussion",
    endsAt,
    players: serializePlayers(room.players),
    narration,
  });

  room.timer = setTimeout(() => startDayVote(io, code), discussionMs);
  logger.info({ code }, "Day discussion started");
}

function startDayVote(io: Server, code: string) {
  const room = rooms.get(code);
  if (!room) return;

  clearRoomTimer(room);
  room.phase = "day-vote";
  room.dayVotes = new Map();

  const voteMs = dayVoteMs(room);
  const endsAt = Date.now() + voteMs;
  room.timerEndsAt = endsAt;

  io.to(code).emit("game-phase", {
    phase: "day-vote",
    endsAt,
    players: serializePlayers(room.players),
    votes: {},
  });

  room.timer = setTimeout(() => resolveDay(io, code), voteMs);
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

  const majority = Math.floor(living(room).length / 2) + 1;
  const maxVotes = voteCounts.size === 0 ? 0 : Math.max(...voteCounts.values());
  const topTargets = Array.from(voteCounts.entries())
    .filter(([, c]) => c === maxVotes)
    .map(([id]) => id);

  if (topTargets.length === 1 && maxVotes >= majority) {
    eliminatedId = topTargets[0];
  } else {
    skipped = true;
  }

  let eliminatedName: string | null = null;

  if (eliminatedId) {
    const target = room.players.get(eliminatedId);
    if (target) {
      target.alive = false;
      eliminatedName = target.name;
    }
  }

  io.to(code).emit("day-result", {
    eliminatedId,
    eliminatedName,
    skipped,
    players: serializePlayers(room.players),
  });

  logger.info({ code, eliminatedName, skipped }, "Day resolved");

  room.timer = setTimeout(() => {
    const winner = checkWin(room);
    if (winner) endGame(io, code, winner);
    else startNightMafia(io, code);
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

  // Intentional leave already scheduled a forfeit — keep soft handling off that seat.
  if (room.pendingForfeits.has(socketId) || room.forfeitedNames.has(player.name.toLowerCase())) {
    player.connected = false;
    return;
  }

  player.connected = false;
  clearPlayerActions(room, socketId);
  emitPlayersUpdated(io, code, room);
  maybeAdvanceNightAfterAbsence(io, code, room);

  const winner = checkWin(room);
  if (
    winner &&
    room.phase !== "night-summary" &&
    room.phase !== "day-result" &&
    room.phase !== "game-over"
  ) {
    clearRoomTimer(room);
    endGame(io, code, winner);
  }
}

function socketClientIp(socket: Socket) {
  const forwarded = socket.handshake.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) return forwarded.split(",")[0].trim();
  if (Array.isArray(forwarded) && forwarded[0]) return String(forwarded[0]).split(",")[0].trim();
  return socket.handshake.address || "unknown";
}

function trackSocketIp(socket: Socket) {
  const ip = socketClientIp(socket);
  socket.data.clientIp = ip;
  let set = socketsByIp.get(ip);
  if (!set) {
    set = new Set();
    socketsByIp.set(ip, set);
  }
  set.add(socket.id);
}

function untrackSocketIp(socket: Socket) {
  const ip = String(socket.data.clientIp ?? socketClientIp(socket));
  const set = socketsByIp.get(ip);
  if (!set) return;
  set.delete(socket.id);
  if (set.size === 0) socketsByIp.delete(ip);
}

function destroyRoom(code: string, room: Room) {
  clearRoomTimer(room);
  clearPendingForfeits(room);
  rooms.delete(code);
  logger.info({ code }, "Room destroyed");
}

function sweepEmptyRooms() {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    const connected = Array.from(room.players.values()).some((p) => p.connected);
    if (connected) {
      room.emptySince = undefined;
      continue;
    }
    if (room.emptySince == null) room.emptySince = now;
    if (now - room.emptySince >= EMPTY_LOBBY_TTL_MS) {
      destroyRoom(code, room);
    }
  }
}

export function registerSocketHandlers(io: Server) {
  setInterval(sweepEmptyRooms, ROOM_GC_INTERVAL_MS);

  io.use((socket, next) => {
    const token = (socket.handshake.auth as { token?: string } | undefined)?.token
      ?? (typeof socket.handshake.headers.authorization === "string"
        ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, "")
        : undefined);
    const user = getUserForToken(token);
    if (!user) {
      next(new Error("Unauthorized"));
      return;
    }
    const ip = socketClientIp(socket);
    const existing = socketsByIp.get(ip);
    if (existing && existing.size >= MAX_SOCKETS_PER_IP) {
      next(new Error("Too many connections from this network"));
      return;
    }
    socket.data.userId = user.id;
    socket.data.userName = user.name;
    next();
  });

  io.on("connection", (socket: Socket) => {
    trackSocketIp(socket);
    logger.info({ socketId: socket.id, userId: socket.data.userId, ip: socket.data.clientIp }, "Socket connected");

    socket.on("create-room", (data: { name: string }) => {
      const name = (data?.name ?? "").trim() || String(socket.data.userName ?? "").trim();
      if (!name) { socket.emit("room-error", { message: "Display name is required" }); return; }
      if (rooms.size >= MAX_OPEN_ROOMS) {
        socket.emit("room-error", { message: "Too many rooms open right now. Try again later." });
        return;
      }

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
        chatMessages: [],
        chatReports: [],
        chatSeq: 0,
        lastChatAt: new Map(),
        timerSettings: { ...DEFAULT_TIMER_SETTINGS },
        forfeitedNames: new Set(),
        pendingForfeits: new Map(),
      };
      rooms.set(code, room);
      socket.join(code);

      socket.emit("room-created", {
        code,
        players: serializePlayers(room.players, false, socket.id),
        isHost: true,
        timerSettings: room.timerSettings,
      });
      logger.info({ code, name }, "Room created");
    });

    socket.on("join-room", (data: { code: string; name: string }) => {
      const code = (data?.code ?? "").trim().toUpperCase();
      const name = (data?.name ?? "").trim() || String(socket.data.userName ?? "").trim();

      if (!code) { socket.emit("room-error", { message: "Room code is required" }); return; }
      if (!name) { socket.emit("room-error", { message: "Display name is required" }); return; }

      const room = rooms.get(code);
      if (!room) { socket.emit("room-error", { message: "Room not found. Check your code." }); return; }
      room.emptySince = undefined;

      if (room.phase !== "lobby") {
        if (room.forfeitedNames.has(name.toLowerCase())) {
          socket.emit("room-error", { message: "You left this game and cannot rejoin." });
          return;
        }

        const disconnected = Array.from(room.players.values()).find(
          (p) => !p.connected && p.name.toLowerCase() === name.toLowerCase(),
        );

        if (!disconnected) {
          socket.emit("room-error", { message: "This game has already started." });
          return;
        }

        // Cancel a pending forfeit only if this seat was a soft drop (not intentional leave).
        const pending = room.pendingForfeits.get(disconnected.id);
        if (pending) {
          socket.emit("room-error", { message: "You left this game and cannot rejoin." });
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
          players: serializePlayers(room.players, false, socket.id),
          isHost: disconnected.isHost,
        });

        socket.emit("role-assigned", {
          role: disconnected.role,
          mafiaNames: disconnected.role === "mafia" ? mafiaNames : [],
          mafiaIds: disconnected.role === "mafia" ? mafiaIds : [],
        });

        socket.emit("chat-history", { messages: room.chatMessages });
        io.to(code).emit("player-rejoined", { name: disconnected.name });
        emitPlayersUpdated(io, code, room);
        logger.info({ code, name }, "Player reconnected");
        return;
      }

      const nameTaken = Array.from(room.players.values()).some(
        (p) => p.name.toLowerCase() === name.toLowerCase(),
      );
      if (nameTaken) { socket.emit("room-error", { message: "That name is already taken in this room." }); return; }
      if (room.players.size >= MAX_PLAYERS_PER_ROOM) {
        socket.emit("room-error", { message: "This room is full." });
        return;
      }

      const player: Player = { id: socket.id, name, isHost: false, alive: true, connected: true, role: null };
      room.players.set(socket.id, player);
      socket.join(code);

      socket.emit("room-joined", {
        code,
        players: serializePlayers(room.players, false, socket.id),
        isHost: false,
        timerSettings: room.timerSettings,
      });
      // Send players-updated individually to each player with their own viewerId
      for (const p of room.players.values()) {
        io.to(p.id).emit("players-updated", { players: serializePlayers(room.players, false, p.id) });
      }
      logger.info({ code, name }, "Player joined room");
    });

    socket.on("set-timer-settings", (data: Partial<TimerSettings>) => {
      for (const [code, room] of rooms.entries()) {
        const player = room.players.get(socket.id);
        if (!player) continue;
        if (!player.isHost || room.phase !== "lobby") {
          socket.emit("room-error", { message: "Only the host can change timers in the lobby." });
          return;
        }
        room.timerSettings = normalizeTimerSettings({
          ...room.timerSettings,
          ...data,
        });
        io.to(code).emit("timer-settings", { timerSettings: room.timerSettings });
        logger.info({ code, timerSettings: room.timerSettings }, "Timer settings updated");
        return;
      }
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
        // Send players-updated individually to each player with their own viewerId
        for (const p of room.players.values()) {
          io.to(p.id).emit("players-updated", { players: serializePlayers(room.players, false, p.id) });
        }
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
        startMatchCountdown(io, code);
        return;
      }
    });

    socket.on("play-again", () => {
      for (const [code, room] of rooms.entries()) {
        const player = room.players.get(socket.id);
        if (!player) continue;
        if (!player.isHost || room.phase !== "game-over") return;

        clearRoomTimer(room);
        clearPendingForfeits(room);
        room.phase = "lobby";
        room.nightVotes = new Map();
        room.dayVotes = new Map();
        room.doctorProtect = new Map();
        room.detectiveInvestigate = new Map();
        room.timerEndsAt = 0;
        room.pendingNarration = "";
        clearDayChat(room);
        room.chatReports = [];
        room.forfeitedNames = new Set();

        for (const [id, p] of room.players.entries()) {
          if (!p.connected) room.players.delete(id);
          else { p.alive = true; p.role = null; }
        }

        // Send room-reset individually to each player with their own viewerId
        for (const p of room.players.values()) {
          io.to(p.id).emit("room-reset", { players: serializePlayers(room.players, false, p.id) });
        }
        io.to(code).emit("timer-settings", { timerSettings: room.timerSettings });
        logger.info({ code }, "Room reset for play again");
        return;
      }
    });

    socket.on("send-chat", (data: { text?: string }) => {
      for (const [code, room] of rooms.entries()) {
        const player = room.players.get(socket.id);
        if (!player) continue;
        if (!player.connected) {
          socket.emit("room-error", { message: "Reconnect to send chat." });
          return;
        }
        const text = (data?.text ?? "").trim();
        if (!text || text.length > 200) {
          socket.emit("room-error", { message: "Message must be 1 to 200 characters." });
          return;
        }
        const now = Date.now();
        const lastAt = room.lastChatAt.get(player.id) ?? 0;
        if (now - lastAt < CHAT_COOLDOWN_MS) {
          socket.emit("room-error", { message: "Wait a moment before sending again." });
          return;
        }
        room.lastChatAt.set(player.id, now);
        room.chatSeq += 1;
        const message: ChatMessage = { id: String(room.chatSeq), name: player.name, text };
        room.chatMessages.push(message);
        emitChatMessage(io, room, message);
        logger.info({ code, name: player.name }, "Chat message");
        return;
      }
    });

    socket.on("leave-game", () => {
      for (const [code, room] of rooms.entries()) {
        const player = room.players.get(socket.id);
        if (!player) continue;

        if (room.phase === "lobby" || room.phase === "game-over") {
          socket.emit("room-error", { message: "Leave is only available during a match." });
          return;
        }
        if (room.pendingForfeits.has(socket.id) || room.forfeitedNames.has(player.name.toLowerCase())) {
          socket.emit("left-game");
          return;
        }

        const playerId = socket.id;
        const name = player.name;
        room.forfeitedNames.add(name.toLowerCase());
        player.connected = false;
        clearPlayerActions(room, playerId);
        maybeAdvanceNightAfterAbsence(io, code, room);
        emitPlayersUpdated(io, code, room);

        const grace = setTimeout(() => applyForfeit(io, code, playerId), TIMERS.FORFEIT_GRACE);
        room.pendingForfeits.set(playerId, grace);

        void socket.leave(code);
        socket.emit("left-game");
        logger.info({ code, name }, "Player leave started — forfeit after grace");
        return;
      }
    });

    socket.on("report-chat", (data: { id?: string }) => {
      for (const [, room] of rooms.entries()) {
        const player = room.players.get(socket.id);
        if (!player) continue;
        const message = room.chatMessages.find((entry) => entry.id === String(data?.id ?? ""));
        if (!message) {
          socket.emit("room-error", { message: "Message not found." });
          return;
        }
        if (!room.chatReports.some((entry) => entry.id === message.id)) {
          room.chatReports.push(message);
        }
        logger.info({ name: message.name, text: message.text, reportedBy: player.name }, "Chat reported");
        return;
      }
    });

    socket.on("block-player", (data: { name?: string }) => {
      for (const [, room] of rooms.entries()) {
        if (!room.players.has(socket.id)) continue;
        const name = (data?.name ?? "").trim();
        if (!name) return;
        const blocked = (socket.data.blockedNames as Set<string> | undefined) ?? new Set<string>();
        blocked.add(name);
        socket.data.blockedNames = blocked;
        return;
      }
    });

    socket.on("night-vote", (data: { targetId: string }) => {
      for (const [code, room] of rooms.entries()) {
        const voter = room.players.get(socket.id);
        if (!voter) continue;
        if (room.phase !== "night-mafia" || !voter.alive || voter.role !== "mafia") return;

        const target = room.players.get(data.targetId);
        if (!target || !target.alive || target.role === "mafia") return;

        const previous = room.nightVotes.get(socket.id);
        room.nightVotes.set(socket.id, data.targetId);
        if (previous !== data.targetId) {
          io.to(code).emit("mafia-kill-sound");
        }
        broadcastNightVoteStatus(io, code);

        // Advance early when all connected mafia have voted — 2s pause before next step
        const connectedMafia = connectedLivingMafia(room);
        const allVoted = connectedMafia.length === 0 || connectedMafia.every((m) => room.nightVotes.has(m.id));
        if (allVoted) {
          clearRoomTimer(room);
          room.timer = setTimeout(() => startNightDoctor(io, code), TIMERS.NIGHT_EARLY_ADVANCE);
        }
        return;
      }
    });

    socket.on("doctor-protect", (data: { targetId: string }) => {
      for (const [code, room] of rooms.entries()) {
        const doctor = room.players.get(socket.id);
        if (!doctor) continue;
        if (room.phase !== "night-doctor" || !doctor.alive || doctor.role !== "doctor") return;

        const target = room.players.get(data.targetId);
        if (!target || !target.alive) return;

        // Only record first selection; but allow changing before early-advance fires
        room.doctorProtect.set(socket.id, data.targetId);
        socket.emit("doctor-protect-ack", { targetId: data.targetId });

        // Advance immediately after first protect selection — 2s pause
        if (room.doctorProtect.size === 1) {
          clearRoomTimer(room);
          room.timer = setTimeout(() => startNightDetective(io, code), TIMERS.NIGHT_EARLY_ADVANCE);
        }
        return;
      }
    });

    socket.on("detective-investigate", (data: { targetId: string }) => {
      for (const [code, room] of rooms.entries()) {
        const detective = room.players.get(socket.id);
        if (!detective) continue;
        if (room.phase !== "night-detective" || !detective.alive || detective.role !== "detective") return;

        const target = room.players.get(data.targetId);
        if (!target || !target.alive || target.id === socket.id) return;

        // Only allow one investigation
        if (room.detectiveInvestigate.has(socket.id)) return;

        room.detectiveInvestigate.set(socket.id, data.targetId);
        socket.emit("detective-investigate-ack", { targetId: data.targetId });

        // Send investigation result immediately and privately
        socket.emit("detective-result", {
          targetName: target.name,
          isMafia: target.role === "mafia",
        });
        logger.info({ detectiveId: socket.id, targetName: target.name, isMafia: target.role === "mafia" }, "Detective result sent");

        // Advance after the detective card flip / result can be read
        clearRoomTimer(room);
        room.timer = setTimeout(() => resolveNight(io, code), TIMERS.DETECTIVE_REVEAL_PAUSE);
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
      untrackSocketIp(socket);
      for (const [code, room] of rooms.entries()) {
        if (!room.players.has(socket.id)) continue;

        if (room.phase === "lobby") {
          const player = room.players.get(socket.id)!;
          const wasHost = player.isHost;
          room.players.delete(socket.id);

          if (room.players.size === 0) {
            destroyRoom(code, room);
          } else {
            if (wasHost) {
              const next = room.players.values().next().value!;
              next.isHost = true;
            }
            io.to(code).emit("players-updated", { players: serializePlayers(room.players) });
          }
          logger.info({ socketId: socket.id }, "Socket disconnected (lobby)");
        } else {
          handleMidGameDisconnect(socket.id, room, io, code);
          const stillConnected = Array.from(room.players.values()).some((p) => p.connected);
          if (!stillConnected) room.emptySince = Date.now();
          logger.info({ socketId: socket.id }, "Socket disconnected (mid-game)");
        }
        return;
      }
      logger.info({ socketId: socket.id }, "Socket disconnected (no room)");
    });
  });
}
