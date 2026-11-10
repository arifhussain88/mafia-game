import crypto from "crypto";
import {
  chatMessagesTable,
  getDb,
  hasDatabaseUrl,
  matchPlayersTable,
  matchesTable,
} from "@workspace/db";
import { bumpProfileAfterMatch, readStore, writeStore, type StoredMatch } from "./user-store";
import { logger } from "./logger";

type PersistPlayer = {
  userId?: string;
  name: string;
  role: string | null;
  alive: boolean;
  /** "survived", "killed night 2", "voted out day 3", "left the match". */
  outcome?: string;
  saves?: number;
  mafiaFound?: number;
  kills?: number;
};

/** Emit already happened — never await this on the hot path. */
export function persistChatMessage(input: {
  roomCode: string;
  userId?: string;
  name: string;
  text: string;
}) {
  if (!hasDatabaseUrl()) return;
  void (async () => {
    try {
      const db = getDb();
      await db.insert(chatMessagesTable).values({
        id: crypto.randomUUID(),
        roomCode: input.roomCode,
        matchId: null,
        userId: input.userId ?? null,
        name: input.name,
        text: input.text,
        createdAt: new Date(),
      });
    } catch (err) {
      logger.warn({ err, roomCode: input.roomCode }, "Failed to persist chat message");
    }
  })();
}

function didWin(winner: "mafia" | "civilians" | "draw", role: string | null): boolean {
  const isMafia = role === "mafia";
  return (winner === "mafia" && isMafia) || (winner === "civilians" && !isMafia);
}

/** JSON store (local dev / tests) keeps the most recent matches only. */
const JSON_MATCH_LIMIT = 500;

/** Emit already happened — never await this on the hot path. */
export function persistMatchEnd(input: {
  roomCode: string;
  /** "draw" when the match stalled out with no deaths (nobody wins). */
  winner: "mafia" | "civilians" | "draw";
  players: PersistPlayer[];
  /** Only for dev demo data; real matches end now. */
  endedAt?: Date;
}) {
  const matchId = crypto.randomUUID();
  const endedAt = input.endedAt ?? new Date();
  const rows = input.players.map((p) => ({
    id: crypto.randomUUID(),
    matchId,
    userId: p.userId ?? null,
    name: p.name,
    role: p.role,
    alive: p.alive,
    won: didWin(input.winner, p.role),
    outcome: p.outcome ?? (p.alive ? "survived" : null),
    saves: p.saves ?? 0,
    mafiaFound: p.mafiaFound ?? 0,
    kills: p.kills ?? 0,
  }));

  if (!hasDatabaseUrl()) {
    try {
      const store = readStore();
      const match: StoredMatch = { id: matchId, roomCode: input.roomCode, winner: input.winner, endedAt: endedAt.toISOString(), players: rows };
      store.matches = [...(store.matches ?? []), match].slice(-JSON_MATCH_LIMIT);
      writeStore(store);
    } catch (err) {
      logger.warn({ err, roomCode: input.roomCode }, "Failed to save match (JSON store)");
    }
    return;
  }

  void (async () => {
    try {
      const db = getDb();
      await db.insert(matchesTable).values({ id: matchId, roomCode: input.roomCode, winner: input.winner, endedAt });
      if (rows.length > 0) await db.insert(matchPlayersTable).values(rows);

      for (const row of rows) {
        if (!row.userId) continue;
        try {
          await bumpProfileAfterMatch(row.userId, row.won);
        } catch (err) {
          logger.warn({ err, userId: row.userId }, "Failed to bump profile");
        }
      }
    } catch (err) {
      logger.warn({ err, roomCode: input.roomCode }, "Failed to persist match");
    }
  })();
}
