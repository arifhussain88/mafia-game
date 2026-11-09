import { Server, Socket } from "socket.io";
import { persistChatMessage, persistMatchEnd } from "./lib/game-persist";
import { logger } from "./lib/logger";
import { DbUnavailableError, getUserForToken } from "./lib/user-store";
import { normaliseReason, saveReport } from "./lib/moderation";
import { containsProfanity, maskProfanity } from "./lib/profanity";


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

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

const MIN_PLAYERS = 3;
const MAX_PLAYERS_PER_ROOM = 12;
/**
 * Capacity guards for the Oracle Always Free VM. Load scales with *concurrent*
 * sockets and rooms (accounts live in Neon and cost the VM nothing), so these
 * are the caps that keep CPU/RAM bounded. Override via env if the box allows.
 */
const MAX_SOCKETS = envInt("MAX_SOCKETS", 400);
const MAX_OPEN_ROOMS = envInt("MAX_OPEN_ROOMS", 150);
/** Generous so a party on one Wi-Fi / carrier NAT can all play. */
const MAX_SOCKETS_PER_IP = envInt("MAX_SOCKETS_PER_IP", 30);
const CHAT_COOLDOWN_MS = 1500;
const EMPTY_LOBBY_TTL_MS = 5 * 60 * 1000;
const ROOM_GC_INTERVAL_MS = 60 * 1000;
/** How long a lobby seat survives a network blip before it is released. */
const LOBBY_GRACE_MS = 30 * 1000;
/** Rounds in a row with no death before the match ends in a draw. */
const MAX_QUIET_ROUNDS = 3;
const SERVER_FULL = "Server is full right now. Try again in a few minutes.";

const socketsByIp = new Map<string, Set<string>>();
let ioRef: Server | null = null;

type Winner = "mafia" | "civilians" | "draw";

/** Client payloads are untrusted: never call string methods on them directly. */
function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function targetIdOf(data: unknown): string | null {
  const t = (data as { targetId?: unknown } | null | undefined)?.targetId;
  return typeof t === "string" && t.length > 0 ? t : null;
}

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
  /** Account id from auth (not socket id). Used for durable history. */
  userId?: string;
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
  /** Author account per chat message id. Kept server-side only, for reports. */
  chatAuthors: Map<string, string | undefined>;
  chatSeq: number;
  lastChatAt: Map<string, number>;
  emptySince?: number;
  timerSettings: TimerSettings;
  /** Seat keys (account id, or name for legacy seats) that intentionally left; cannot rejoin. */
  forfeited: Set<string>;
  pendingForfeits: Map<string, ReturnType<typeof setTimeout>>;
  /** Lobby seats waiting out a network blip, keyed by seat id. */
  lobbyGrace: Map<string, ReturnType<typeof setTimeout>>;
  /** Snapshot pieces so a rejoining player sees what everyone else sees. */
  dayNarration: string;
  nightSummaryLines: string[];
  lastDayResult: { eliminatedId: string | null; eliminatedName: string | null; skipped: boolean } | null;
  detectiveResult: { detectiveId: string; targetName: string; isMafia: boolean } | null;
  winner: Winner | null;
  nightHadDeath: boolean;
  quietRounds: number;
}

function seatKey(p: Player): string {
  return p.userId ?? `name:${p.name.toLowerCase()}`;
}

function hasForfeited(room: Room, p: Player): boolean {
  return room.forfeited.has(seatKey(p));
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

function checkWin(room: Room): Winner | null {
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

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function assignRoles(room: Room) {
  const playerList = Array.from(room.players.values());
  // Dev-only shortcut for the four test logins. Never in production, where a
  // group could otherwise pick these names to rig the roles.
  if (process.env.NODE_ENV !== "production") {
    const names = new Set(playerList.map((p) => p.name));
    const fixedNames = Object.keys(FIXED_TEST_ROLES);
    if (playerList.length === 4 && fixedNames.every((name) => names.has(name))) {
      for (const player of playerList) {
        player.alive = true;
        player.role = FIXED_TEST_ROLES[player.name];
      }
      return;
    }
  }

  const n = playerList.length;
  const mafiaCount = n >= 7 ? 2 : 1;
  // Keep each seat's real `connected` flag: a player who dropped during the
  // countdown must not be treated as online (timers would wait on them).
  shuffle(playerList).forEach((p, i) => {
    p.alive = true;
    if (i < mafiaCount) p.role = "mafia";
    else if (i === mafiaCount) p.role = "doctor";
    else if (i === mafiaCount + 1) p.role = "detective";
    else p.role = "civilian";
  });
}

function clearDayChat(room: Room) {
  room.chatMessages = [];
  room.chatAuthors = new Map();
  room.lastChatAt = new Map();
}

function clearPendingForfeits(room: Room) {
  for (const timer of room.pendingForfeits.values()) clearTimeout(timer);
  room.pendingForfeits.clear();
}

function clearLobbyGrace(room: Room) {
  for (const timer of room.lobbyGrace.values()) clearTimeout(timer);
  room.lobbyGrace.clear();
}

function remapIds(map: Map<string, string>, oldId: string, newId: string): Map<string, string> {
  const next = new Map<string, string>();
  for (const [k, v] of map) next.set(k === oldId ? newId : k, v === oldId ? newId : v);
  return next;
}

function remapKey<V>(map: Map<string, V>, oldId: string, newId: string): Map<string, V> {
  const next = new Map<string, V>();
  for (const [k, v] of map) next.set(k === oldId ? newId : k, v);
  return next;
}

/**
 * Move a seat to a new id (a reconnecting socket, or a detached "left:" id).
 * Every structure keyed by player id is rewritten so votes cast by or against
 * this player survive, and seat order is preserved for the table layout.
 */
function rebindSeat(room: Room, player: Player, newId: string) {
  const oldId = player.id;
  if (oldId === newId) return;
  room.players = remapKey(room.players, oldId, newId);
  player.id = newId;
  room.nightVotes = remapIds(room.nightVotes, oldId, newId);
  room.dayVotes = remapIds(room.dayVotes, oldId, newId);
  room.doctorProtect = remapIds(room.doctorProtect, oldId, newId);
  room.detectiveInvestigate = remapIds(room.detectiveInvestigate, oldId, newId);
  room.lastChatAt = remapKey(room.lastChatAt, oldId, newId);
  room.pendingForfeits = remapKey(room.pendingForfeits, oldId, newId);
  room.lobbyGrace = remapKey(room.lobbyGrace, oldId, newId);
  if (room.lastDayResult?.eliminatedId === oldId) room.lastDayResult.eliminatedId = newId;
  if (room.detectiveResult?.detectiveId === oldId) room.detectiveResult.detectiveId = newId;
}

/** Mafia teammates track each other by id; refresh them after any id change. */
function emitMafiaRoster(io: Server, room: Room) {
  const { mafiaNames, mafiaIds } = getMafiaInfo(room);
  for (const p of room.players.values()) {
    if (p.role !== "mafia") continue;
    io.to(p.id).emit("role-assigned", { role: p.role, mafiaNames, mafiaIds });
  }
}

function dayVoteCounts(room: Room): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const targetId of room.dayVotes.values()) counts[targetId] = (counts[targetId] ?? 0) + 1;
  return counts;
}

function findSeatByUser(room: Room, userId: string): Player | undefined {
  for (const p of room.players.values()) if (p.userId === userId) return p;
  return undefined;
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
  room.forfeited.add(seatKey(player));

  if (wasHost) transferHost(room);

  io.to(code).emit("player-left", { name });
  emitPlayersUpdated(io, code, room);

  if (room.phase === "day-vote") {
    io.to(code).emit("day-vote-update", { votes: dayVoteCounts(room) });
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
  // Mafia only: the head count would tell the town how many Mafia are online.
  const mafia = connectedLivingMafia(room);
  const status = { voted: room.nightVotes.size, total: mafia.length };
  for (const m of mafia) io.to(m.id).emit("night-vote-status", status);
}

function startMatchCountdown(io: Server, code: string) {
  const room = rooms.get(code);
  if (!room) return;

  clearRoomTimer(room);
  room.phase = "match-countdown";
  room.winner = null;
  room.quietRounds = 0;
  room.nightHadDeath = false;
  room.dayNarration = "";
  room.nightSummaryLines = [];
  room.lastDayResult = null;
  room.detectiveResult = null;
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
  room.detectiveResult = null;
  room.nightSummaryLines = [];

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
  room.nightSummaryLines = lines;
  room.nightHadDeath = eliminatedName !== null;

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
  room.dayNarration = narration;

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
    io.to(code).emit("mafia-kill-sound");
  }

  room.lastDayResult = { eliminatedId, eliminatedName, skipped };
  // A full night + day with no death. If the table keeps stalling (idle
  // players, nobody votes) end it rather than looping forever.
  if (!eliminatedName && !room.nightHadDeath) room.quietRounds += 1;
  else room.quietRounds = 0;

  io.to(code).emit("day-result", {
    eliminatedId,
    eliminatedName,
    skipped,
    players: serializePlayers(room.players),
  });

  logger.info({ code, eliminatedName, skipped, quietRounds: room.quietRounds }, "Day resolved");

  room.timer = setTimeout(() => {
    const roomNow = rooms.get(code);
    if (!roomNow || roomNow.phase !== "day-result") return;
    const winner = checkWin(roomNow);
    if (winner) endGame(io, code, winner);
    else if (roomNow.quietRounds >= MAX_QUIET_ROUNDS) endGame(io, code, "draw");
    else startNightMafia(io, code);
  }, TIMERS.DAY_RESULT);
}

function endGame(io: Server, code: string, winner: Winner) {
  const room = rooms.get(code);
  if (!room) return;

  clearRoomTimer(room);
  clearPendingForfeits(room);
  room.phase = "game-over";
  room.winner = winner;

  io.to(code).emit("game-over", {
    winner,
    players: serializePlayers(room.players, true),
  });

  persistMatchEnd({
    roomCode: code,
    winner,
    players: Array.from(room.players.values()).map((p) => ({
      userId: p.userId,
      name: p.name,
      role: p.role,
      alive: p.alive,
    })),
  });

  logger.info({ code, winner }, "Game over");
}

function handleMidGameDisconnect(socketId: string, room: Room, io: Server, code: string) {
  const player = room.players.get(socketId);
  if (!player) return;

  // Intentional leave already scheduled a forfeit — keep soft handling off that seat.
  if (room.pendingForfeits.has(socketId) || hasForfeited(room, player)) {
    player.connected = false;
    return;
  }

  // Soft drop: keep their votes and any votes against them, so a quick
  // reconnect resumes exactly where they were.
  player.connected = false;
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

/**
 * A user (account) may hold at most one live seat across all rooms. Seats that
 * left, forfeited, or whose match is over don't count; `exceptCode` skips the
 * room the user is rejoining.
 */
function userHasActiveSeat(userId: unknown, exceptCode?: string): boolean {
  if (typeof userId !== "string") return false;
  for (const [code, room] of rooms) {
    if (code === exceptCode || room.phase === "game-over") continue;
    for (const p of room.players.values()) {
      if (p.userId !== userId || hasForfeited(room, p)) continue;
      // A dropped mid-game seat still belongs to the user (they can rejoin it);
      // a dropped lobby seat is about to be released, so it doesn't block.
      if (p.connected || room.phase !== "lobby") return true;
    }
  }
  return false;
}

function socketInAnyRoom(socketId: string): boolean {
  for (const room of rooms.values()) if (room.players.has(socketId)) return true;
  return false;
}

/**
 * Drop this user's stale seats before they sit elsewhere: a lobby seat in its
 * grace window is released, a finished match forgets them, and a dropped seat
 * in a running match is forfeited (choosing a new room = leaving the old one;
 * otherwise a lost phone or room code would lock them out until it ends).
 * Seats that are actively connected on another device are left alone.
 */
function releaseStaleSeats(io: Server, userId: unknown) {
  if (typeof userId !== "string") return;
  for (const [code, room] of rooms) {
    const seat = findSeatByUser(room, userId);
    if (!seat || seat.connected || hasForfeited(room, seat)) continue;
    if (room.phase === "lobby") removeLobbySeat(io, code, room, seat);
    else if (room.phase === "game-over") seat.userId = undefined;
    else forfeitSeat(io, code, room, seat);
  }
}

/**
 * Intentional leave from a running match: the seat is detached from its socket
 * at once (so the user can sit elsewhere) and turns into a forfeit after a
 * short grace so the table sees it happen.
 */
function forfeitSeat(io: Server, code: string, room: Room, player: Player) {
  room.forfeited.add(seatKey(player));
  player.connected = false;
  clearPlayerActions(room, player.id);
  const detachedId = player.id.startsWith("left:") ? player.id : `left:${player.id}`;
  rebindSeat(room, player, detachedId);
  maybeAdvanceNightAfterAbsence(io, code, room);
  emitPlayersUpdated(io, code, room);
  const grace = setTimeout(() => applyForfeit(io, code, detachedId), TIMERS.FORFEIT_GRACE);
  room.pendingForfeits.set(detachedId, grace);
  logger.info({ code, name: player.name }, "Player leave started — forfeit after grace");
}

function removeLobbySeat(io: Server, code: string, room: Room, seat: Player) {
  const grace = room.lobbyGrace.get(seat.id);
  if (grace) clearTimeout(grace);
  room.lobbyGrace.delete(seat.id);
  room.players.delete(seat.id);
  if (room.players.size === 0) {
    destroyRoom(code, room);
    return;
  }
  if (seat.isHost) {
    const next =
      Array.from(room.players.values()).find((p) => p.connected) ?? room.players.values().next().value!;
    next.isHost = true;
  }
  emitPlayersUpdated(io, code, room);
}

/**
 * Account deleted: forget the account on any live seat so match/chat saves
 * don't reference a removed user, and drop its sockets.
 */
/** Cut every live connection of an account (e.g. after a ban), with a reason shown to the player. */
export function disconnectUser(userId: string, message: string) {
  if (!ioRef) return;
  for (const s of ioRef.sockets.sockets.values()) {
    if (s.data.userId !== userId) continue;
    s.emit("account-suspended", { message });
    s.disconnect(true);
  }
}

export function forgetUser(userId: string) {
  for (const room of rooms.values()) {
    for (const p of room.players.values()) if (p.userId === userId) p.userId = undefined;
  }
  if (!ioRef) return;
  for (const s of ioRef.sockets.sockets.values()) {
    if (s.data.userId === userId) s.disconnect(true);
  }
}

/** Snapshot of the room for a (re)joining socket, so it matches what others see. */
function sendRejoinSnapshot(io: Server, socket: Socket, code: string, room: Room, seat: Player) {
  const id = seat.id;
  const isMafia = seat.role === "mafia";
  const isDetective = seat.role === "detective";
  socket.emit("reconnected", {
    code,
    name: seat.name,
    phase: room.phase,
    endsAt: room.timerEndsAt,
    players: serializePlayers(room.players, room.phase === "game-over", id),
    isHost: seat.isHost,
    timerSettings: room.timerSettings,
    myNightVote: room.nightVotes.get(id) ?? null,
    myDoctorVote: room.doctorProtect.get(id) ?? null,
    myDetectiveVote: room.detectiveInvestigate.get(id) ?? null,
    myDayVote: room.dayVotes.get(id) ?? null,
    dayVotes: dayVoteCounts(room),
    narration: room.dayNarration || null,
    nightSummaryLines: room.nightSummaryLines,
    dayResult: room.phase === "day-result" ? room.lastDayResult : null,
    detectiveResult:
      isDetective && room.detectiveResult?.detectiveId === id
        ? { targetName: room.detectiveResult.targetName, isMafia: room.detectiveResult.isMafia }
        : null,
    winner: room.phase === "game-over" ? room.winner : null,
  });

  if (seat.role) {
    const { mafiaNames, mafiaIds } = getMafiaInfo(room);
    socket.emit("role-assigned", {
      role: seat.role,
      mafiaNames: isMafia ? mafiaNames : [],
      mafiaIds: isMafia ? mafiaIds : [],
    });
  }
  if (isMafia && room.phase === "night-mafia") {
    socket.emit("night-vote-status", {
      voted: room.nightVotes.size,
      total: connectedLivingMafia(room).length,
    });
  }
  socket.emit("chat-history", { messages: room.chatMessages });
}

type RejoinResult = "ok" | "no-seat" | "left";

/**
 * Put this socket back into the seat its account holds in `room`. Works in the
 * lobby (within LOBBY_GRACE_MS), mid-game, and at game over. If the old socket
 * still looks connected (phone came back before the server noticed the drop),
 * the new socket takes over and the old one is cut.
 */
function rejoinSeat(io: Server, socket: Socket, code: string, room: Room): RejoinResult {
  const userId = typeof socket.data.userId === "string" ? socket.data.userId : undefined;
  if (!userId) return "no-seat";
  const seat = findSeatByUser(room, userId);
  if (!seat) return "no-seat";
  if (hasForfeited(room, seat) || room.pendingForfeits.has(seat.id) || seat.id.startsWith("left:")) {
    return "left";
  }

  const oldId = seat.id;
  const lobbyTimer = room.lobbyGrace.get(oldId);
  if (lobbyTimer) {
    clearTimeout(lobbyTimer);
    room.lobbyGrace.delete(oldId);
  }

  rebindSeat(room, seat, socket.id);
  seat.connected = true;
  room.emptySince = undefined;
  socket.join(code);

  if (oldId !== socket.id) {
    const oldSocket = io.sockets.sockets.get(oldId);
    if (oldSocket) {
      // Already rebound, so the old socket's disconnect handler won't find a seat.
      void oldSocket.leave(code);
      oldSocket.emit("room-error", { message: "You opened this game somewhere else." });
      oldSocket.disconnect(true);
    }
  }

  sendRejoinSnapshot(io, socket, code, room, seat);
  // Tell everyone else; the rejoining player gets their own "Reconnected" toast.
  if (room.phase !== "lobby") socket.to(code).emit("player-rejoined", { name: seat.name });
  emitPlayersUpdated(io, code, room);
  if (seat.role === "mafia" && oldId !== socket.id) emitMafiaRoster(io, room);
  logger.info({ code, name: seat.name, phase: room.phase }, "Player rejoined seat");
  return "ok";
}

const ALREADY_SEATED = "You're already in a room (maybe in another tab or device). Leave it first.";

function isLoopback(addr: string) {
  return addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
}

/** Real client IP. X-Forwarded-For is only trusted when the hop is our local Caddy. */
function socketClientIp(socket: Socket) {
  const direct = socket.handshake.address || "unknown";
  if (!isLoopback(direct)) return direct;
  const forwarded = socket.handshake.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded.join(",") : forwarded;
  if (typeof raw === "string" && raw.length > 0) {
    const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
    // Rightmost entry is the one appended by the trusted proxy.
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return direct;
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
  clearLobbyGrace(room);
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

function newRoom(code: string, host: Player): Room {
  return {
    code,
    players: new Map([[host.id, host]]),
    phase: "lobby",
    nightVotes: new Map(),
    dayVotes: new Map(),
    doctorProtect: new Map(),
    detectiveInvestigate: new Map(),
    timerEndsAt: 0,
    pendingNarration: "",
    chatMessages: [],
    chatAuthors: new Map(),
    chatSeq: 0,
    lastChatAt: new Map(),
    timerSettings: { ...DEFAULT_TIMER_SETTINGS },
    forfeited: new Set(),
    pendingForfeits: new Map(),
    lobbyGrace: new Map(),
    dayNarration: "",
    nightSummaryLines: [],
    lastDayResult: null,
    detectiveResult: null,
    winner: null,
    nightHadDeath: false,
    quietRounds: 0,
  };
}

function userHasAnySeat(userId: unknown): boolean {
  if (typeof userId !== "string") return false;
  for (const room of rooms.values()) if (findSeatByUser(room, userId)) return true;
  return false;
}

let lastLoadLog = "";
function logLoad(io: Server) {
  const line = `${rooms.size}/${io.sockets.sockets.size}`;
  if (line === lastLoadLog) return;
  lastLoadLog = line;
  logger.info({ rooms: rooms.size, sockets: io.sockets.sockets.size, maxSockets: MAX_SOCKETS }, "Load");
}

export function registerSocketHandlers(io: Server) {
  ioRef = io;
  setInterval(() => {
    sweepEmptyRooms();
    logLoad(io);
  }, ROOM_GC_INTERVAL_MS);

  io.use(async (socket, next) => {
    const token = (socket.handshake.auth as { token?: string } | undefined)?.token
      ?? (typeof socket.handshake.headers.authorization === "string"
        ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, "")
        : undefined);
    try {
      const user = await getUserForToken(token);
      if (!user) {
        next(new Error("Unauthorized"));
        return;
      }
      if (user.bannedAt) {
        next(new Error("Account suspended"));
        return;
      }
      // Global cap protects the free VM. Players returning to a seat they hold
      // are always let back in so a full server never strands a live match.
      if (io.sockets.sockets.size >= MAX_SOCKETS && !userHasAnySeat(user.id)) {
        next(new Error(SERVER_FULL));
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
    } catch (err) {
      // Do not map DB blips to Unauthorized (that clears mafia-token on the client).
      if (err instanceof DbUnavailableError) {
        next(new Error("Service unavailable"));
        return;
      }
      next(err instanceof Error ? err : new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket: Socket) => {
    trackSocketIp(socket);
    logger.info({ socketId: socket.id, userId: socket.data.userId, ip: socket.data.clientIp }, "Socket connected");

    /** One bad payload or bug in a handler must never crash the process. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const on = (event: string, handler: (data?: any) => void) => {
      socket.on(event, (data?: unknown) => {
        try {
          handler(data);
        } catch (err) {
          logger.error({ err, event, socketId: socket.id }, "Socket handler failed");
        }
      });
    };

    on("create-room", (data: { name?: unknown } | undefined) => {
      const name = str(data?.name) || str(socket.data.userName);
      if (!name) { socket.emit("room-error", { message: "Display name is required" }); return; }
      if (name.length > 24) { socket.emit("room-error", { message: "Display name must be 24 characters or fewer" }); return; }
      if (containsProfanity(name)) { socket.emit("room-error", { message: "Please choose a different display name." }); return; }
      releaseStaleSeats(io, socket.data.userId);
      if (socketInAnyRoom(socket.id) || userHasActiveSeat(socket.data.userId)) {
        socket.emit("room-error", { message: ALREADY_SEATED });
        return;
      }
      if (rooms.size >= MAX_OPEN_ROOMS) {
        socket.emit("room-error", { message: SERVER_FULL });
        return;
      }

      let code = generateCode();
      while (rooms.has(code)) code = generateCode();

      const player: Player = {
        id: socket.id,
        name,
        userId: typeof socket.data.userId === "string" ? socket.data.userId : undefined,
        isHost: true,
        alive: true,
        connected: true,
        role: null,
      };
      const room = newRoom(code, player);
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

    /** Sent by the client after any reconnect or page reload while it remembers a room. */
    on("rejoin-room", (data: { code?: unknown } | undefined) => {
      const code = str(data?.code).toUpperCase();
      const room = code ? rooms.get(code) : undefined;
      if (!room) {
        socket.emit("rejoin-failed", { message: "That game has ended." });
        return;
      }
      if (userHasActiveSeat(socket.data.userId, code) && !findSeatByUser(room, String(socket.data.userId))) {
        socket.emit("rejoin-failed", { message: ALREADY_SEATED });
        return;
      }
      const result = rejoinSeat(io, socket, code, room);
      if (result === "ok") return;
      socket.emit("rejoin-failed", {
        message: result === "left" ? "You left this game and cannot rejoin." : "You're no longer in that game.",
      });
    });

    on("join-room", (data: { code?: unknown; name?: unknown } | undefined) => {
      const code = str(data?.code).toUpperCase();
      const name = str(data?.name) || str(socket.data.userName);

      if (!code) { socket.emit("room-error", { message: "Room code is required" }); return; }
      if (!name) { socket.emit("room-error", { message: "Display name is required" }); return; }

      const room = rooms.get(code);
      if (!room) { socket.emit("room-error", { message: "Room not found. Check your code." }); return; }

      // Seats are bound to the account (userId), never to the display name the
      // client sends — otherwise anyone with the room code could take over a
      // dropped player's seat and see their role. Typing the code of a game you
      // are already seated in simply resumes that seat.
      const resumed = rejoinSeat(io, socket, code, room);
      if (resumed === "ok") return;

      if (room.phase !== "lobby") {
        socket.emit("room-error", {
          message: resumed === "left" ? "You left this game and cannot rejoin." : "This game has already started.",
        });
        return;
      }

      if (name.length > 24) { socket.emit("room-error", { message: "Display name must be 24 characters or fewer" }); return; }
      if (containsProfanity(name)) { socket.emit("room-error", { message: "Please choose a different display name." }); return; }
      releaseStaleSeats(io, socket.data.userId);
      if (socketInAnyRoom(socket.id) || userHasActiveSeat(socket.data.userId)) {
        socket.emit("room-error", { message: ALREADY_SEATED });
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

      const player: Player = {
        id: socket.id,
        name,
        userId: typeof socket.data.userId === "string" ? socket.data.userId : undefined,
        isHost: false,
        alive: true,
        connected: true,
        role: null,
      };
      room.players.set(socket.id, player);
      room.emptySince = undefined;
      socket.join(code);

      socket.emit("room-joined", {
        code,
        players: serializePlayers(room.players, false, socket.id),
        isHost: false,
        timerSettings: room.timerSettings,
      });
      emitPlayersUpdated(io, code, room);
      logger.info({ code, name }, "Player joined room");
    });

    on("set-timer-settings", (data: Partial<TimerSettings>) => {
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

    on("kick-player", (data) => {
      const targetId = targetIdOf(data);
      if (!targetId) return;
      for (const [code, room] of rooms.entries()) {
        const kicker = room.players.get(socket.id);
        if (!kicker) continue;
        if (!kicker.isHost || room.phase !== "lobby") return;

        const target = room.players.get(targetId);
        if (!target || target.id === socket.id) return;

        const grace = room.lobbyGrace.get(targetId);
        if (grace) clearTimeout(grace);
        room.lobbyGrace.delete(targetId);
        room.players.delete(targetId);
        io.to(targetId).emit("kicked");
        // Out of the broadcast group too, or the kicked socket keeps receiving this room's events.
        io.in(targetId).socketsLeave(code);
        emitPlayersUpdated(io, code, room);
        logger.info({ code, kickedName: target.name }, "Player kicked");
        return;
      }
    });

    on("start-game", () => {
      for (const [code, room] of rooms.entries()) {
        const player = room.players.get(socket.id);
        if (!player) continue;
        if (!player.isHost) { socket.emit("room-error", { message: "Only the host can start the game." }); return; }
        if (room.phase !== "lobby") return;
        // Seats still in their reconnect grace window don't get dealt in.
        for (const p of Array.from(room.players.values())) {
          if (!p.connected) removeLobbySeat(io, code, room, p);
        }
        if (room.players.size < MIN_PLAYERS) {
          socket.emit("room-error", { message: `Need at least ${MIN_PLAYERS} players to start.` });
          return;
        }
        startMatchCountdown(io, code);
        return;
      }
    });

    on("play-again", () => {
      for (const [code, room] of rooms.entries()) {
        const player = room.players.get(socket.id);
        if (!player) continue;
        if (!player.isHost || room.phase !== "game-over") return;

        clearRoomTimer(room);
        clearPendingForfeits(room);
        clearLobbyGrace(room);
        room.phase = "lobby";
        room.nightVotes = new Map();
        room.dayVotes = new Map();
        room.doctorProtect = new Map();
        room.detectiveInvestigate = new Map();
        room.timerEndsAt = 0;
        room.pendingNarration = "";
        room.winner = null;
        clearDayChat(room);
        room.chatAuthors = new Map();
        room.forfeited = new Set();

        for (const [id, p] of Array.from(room.players.entries())) {
          if (!p.connected) room.players.delete(id);
          else { p.alive = true; p.role = null; }
        }
        transferHost(room);

        // Send room-reset individually to each player with their own viewerId
        for (const p of room.players.values()) {
          io.to(p.id).emit("room-reset", { players: serializePlayers(room.players, false, p.id) });
        }
        io.to(code).emit("timer-settings", { timerSettings: room.timerSettings });
        logger.info({ code }, "Room reset for play again");
        return;
      }
    });

    on("send-chat", (data: { text?: string }) => {
      for (const [code, room] of rooms.entries()) {
        const player = room.players.get(socket.id);
        if (!player) continue;
        if (!player.connected) {
          socket.emit("room-error", { message: "Reconnect to send chat." });
          return;
        }
        if (
          room.phase !== "lobby" &&
          room.phase !== "game-over" &&
          !player.alive
        ) {
          socket.emit("room-error", { message: "Eliminated players can only watch chat." });
          return;
        }
        const text = str(data?.text);
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
        const message: ChatMessage = { id: String(room.chatSeq), name: player.name, text: maskProfanity(text) };
        room.chatAuthors.set(message.id, player.userId);
        room.chatMessages.push(message);
        emitChatMessage(io, room, message);
        persistChatMessage({
          roomCode: code,
          userId: player.userId,
          name: player.name,
          text,
        });
        logger.info({ code, name: player.name }, "Chat message");
        return;
      }
    });

    on("leave-game", () => {
      for (const [code, room] of rooms.entries()) {
        const player = room.players.get(socket.id);
        if (!player) continue;

        // Leaving the lobby or the results screen: no forfeit, just give the seat up.
        if (room.phase === "lobby") {
          removeLobbySeat(io, code, room, player);
          void socket.leave(code);
          socket.emit("left-game");
          return;
        }
        if (room.phase === "game-over") {
          player.connected = false;
          rebindSeat(room, player, `left:${socket.id}`);
          transferHost(room);
          void socket.leave(code);
          emitPlayersUpdated(io, code, room);
          socket.emit("left-game");
          return;
        }

        forfeitSeat(io, code, room, player);
        void socket.leave(code);
        socket.emit("left-game");
        return;
      }
    });

    /** At most 10 reports per connection per 10 minutes, so reports can't be used to spam. */
    const reportTimes: number[] = [];
    const reportAllowed = () => {
      const now = Date.now();
      while (reportTimes.length && now - reportTimes[0] > 10 * 60 * 1000) reportTimes.shift();
      if (reportTimes.length >= 10) return false;
      reportTimes.push(now);
      return true;
    };

    const fileReport = (
      code: string,
      reporter: Player,
      reported: { userId?: string; name: string },
      reason: unknown,
      message: string | null,
    ) => {
      if (!reportAllowed()) {
        socket.emit("room-error", { message: "You've sent a lot of reports. Try again later." });
        return;
      }
      saveReport({
        reporterId: reporter.userId ?? null,
        reporterName: reporter.name,
        reportedId: reported.userId ?? null,
        reportedName: reported.name,
        roomCode: code,
        reason: normaliseReason(reason),
        message,
      })
        .then(() => socket.emit("report-received"))
        .catch((err) => {
          logger.error({ err, code }, "Failed to save report");
          socket.emit("room-error", { message: "Couldn't send the report. Try again." });
        });
      logger.info({ code, reportedName: reported.name, reason: normaliseReason(reason) }, "Report filed");
    };

    on("report-chat", (data: { id?: unknown; reason?: unknown } | undefined) => {
      for (const [code, room] of rooms.entries()) {
        const player = room.players.get(socket.id);
        if (!player) continue;
        const message = room.chatMessages.find((entry) => entry.id === String(data?.id ?? ""));
        if (!message) {
          socket.emit("room-error", { message: "Message not found." });
          return;
        }
        fileReport(code, player, { userId: room.chatAuthors.get(message.id), name: message.name }, data?.reason ?? "harassment", message.text);
        return;
      }
    });

    on("report-player", (data: { targetId?: unknown; reason?: unknown } | undefined) => {
      const targetId = targetIdOf(data);
      if (!targetId) return;
      for (const [code, room] of rooms.entries()) {
        const player = room.players.get(socket.id);
        if (!player) continue;
        const target = room.players.get(targetId);
        if (!target || target.id === socket.id) return;
        fileReport(code, player, { userId: target.userId, name: target.name }, data?.reason, null);
        return;
      }
    });

    on("block-player", (data: { name?: unknown } | undefined) => {
      for (const [, room] of rooms.entries()) {
        if (!room.players.has(socket.id)) continue;
        const name = str(data?.name);
        if (!name) return;
        const blocked = (socket.data.blockedNames as Set<string> | undefined) ?? new Set<string>();
        blocked.add(name);
        socket.data.blockedNames = blocked;
        return;
      }
    });

    on("night-vote", (data) => {
      const targetId = targetIdOf(data);
      if (!targetId) return;
      for (const [code, room] of rooms.entries()) {
        const voter = room.players.get(socket.id);
        if (!voter) continue;
        if (room.phase !== "night-mafia" || !voter.alive || voter.role !== "mafia") return;

        const target = room.players.get(targetId);
        if (!target || !target.alive || target.role === "mafia") return;

        room.nightVotes.set(socket.id, targetId);
        io.to(code).emit("mafia-kill-sound");
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

    on("doctor-protect", (data) => {
      const targetId = targetIdOf(data);
      if (!targetId) return;
      for (const [code, room] of rooms.entries()) {
        const doctor = room.players.get(socket.id);
        if (!doctor) continue;
        if (room.phase !== "night-doctor" || !doctor.alive || doctor.role !== "doctor") return;

        const target = room.players.get(targetId);
        if (!target || !target.alive) return;

        // Only record first selection; but allow changing before early-advance fires
        room.doctorProtect.set(socket.id, targetId);
        socket.emit("doctor-protect-ack", { targetId });

        // Advance immediately after first protect selection — 2s pause
        if (room.doctorProtect.size === 1) {
          clearRoomTimer(room);
          room.timer = setTimeout(() => startNightDetective(io, code), TIMERS.NIGHT_EARLY_ADVANCE);
        }
        return;
      }
    });

    on("detective-investigate", (data) => {
      const targetId = targetIdOf(data);
      if (!targetId) return;
      for (const [code, room] of rooms.entries()) {
        const detective = room.players.get(socket.id);
        if (!detective) continue;
        if (room.phase !== "night-detective" || !detective.alive || detective.role !== "detective") return;

        const target = room.players.get(targetId);
        if (!target || !target.alive || target.id === socket.id) return;

        // Only allow one investigation
        if (room.detectiveInvestigate.has(socket.id)) return;

        room.detectiveInvestigate.set(socket.id, targetId);
        socket.emit("detective-investigate-ack", { targetId });

        // Send investigation result immediately and privately
        const result = { targetName: target.name, isMafia: target.role === "mafia" };
        room.detectiveResult = { detectiveId: socket.id, ...result };
        socket.emit("detective-result", result);
        logger.info({ code, isMafia: result.isMafia }, "Detective result sent");

        // Advance after the detective card flip / result can be read
        clearRoomTimer(room);
        room.timer = setTimeout(() => resolveNight(io, code), TIMERS.DETECTIVE_REVEAL_PAUSE);
        return;
      }
    });

    on("day-vote", (data) => {
      const targetId = targetIdOf(data);
      if (!targetId) return;
      for (const [code, room] of rooms.entries()) {
        const voter = room.players.get(socket.id);
        if (!voter) continue;
        if (room.phase !== "day-vote" || !voter.alive || targetId === socket.id) return;
        if (room.dayVotes.has(socket.id)) return;

        const target = room.players.get(targetId);
        if (!target || !target.alive) return;

        room.dayVotes.set(socket.id, targetId);

        const voteCounts = dayVoteCounts(room);
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
        const player = room.players.get(socket.id);
        if (!player) continue;

        if (room.phase === "lobby") {
          // Hold the seat (and host) briefly so a network blip doesn't boot them.
          player.connected = false;
          emitPlayersUpdated(io, code, room);
          const timer = setTimeout(() => {
            const current = rooms.get(code);
            if (!current || current.phase !== "lobby") return;
            current.lobbyGrace.delete(player.id);
            if (player.connected || current.players.get(player.id) !== player) return;
            removeLobbySeat(io, code, current, player);
          }, LOBBY_GRACE_MS);
          room.lobbyGrace.set(player.id, timer);
          if (!Array.from(room.players.values()).some((p) => p.connected)) room.emptySince = Date.now();
          logger.info({ socketId: socket.id, code }, "Socket disconnected (lobby, seat held)");
        } else {
          handleMidGameDisconnect(socket.id, room, io, code);
          const stillConnected = Array.from(room.players.values()).some((p) => p.connected);
          if (!stillConnected) room.emptySince = Date.now();
          logger.info({ socketId: socket.id, code }, "Socket disconnected (mid-game)");
        }
        return;
      }
      logger.info({ socketId: socket.id }, "Socket disconnected (no room)");
    });
  });
}
