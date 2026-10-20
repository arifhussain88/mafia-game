import crypto from "crypto";
import {
  chatMessagesTable,
  getDb,
  hasDatabaseUrl,
  matchPlayersTable,
  matchesTable,
} from "@workspace/db";
import { bumpProfileAfterMatch } from "./user-store";
import { logger } from "./logger";

type PersistPlayer = {
  userId?: string;
  name: string;
  role: string | null;
  alive: boolean;
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

/** Emit already happened — never await this on the hot path. */
export function persistMatchEnd(input: {
  roomCode: string;
  winner: "mafia" | "civilians";
  players: PersistPlayer[];
}) {
  if (!hasDatabaseUrl()) return;
  void (async () => {
    try {
      const db = getDb();
      const matchId = crypto.randomUUID();
      await db.insert(matchesTable).values({
        id: matchId,
        roomCode: input.roomCode,
        winner: input.winner,
        endedAt: new Date(),
      });

      const rows = input.players.map((p) => {
        const isMafia = p.role === "mafia";
        const won =
          (input.winner === "mafia" && isMafia) ||
          (input.winner === "civilians" && !isMafia);
        return {
          id: crypto.randomUUID(),
          matchId,
          userId: p.userId ?? null,
          name: p.name,
          role: p.role,
          alive: p.alive,
          won,
        };
      });
      if (rows.length > 0) {
        await db.insert(matchPlayersTable).values(rows);
      }

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
