import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const matchesTable = pgTable("matches", {
  id: text("id").primaryKey(),
  roomCode: text("room_code").notNull(),
  winner: text("winner").notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }).notNull().defaultNow(),
});

export const matchPlayersTable = pgTable("match_players", {
  id: text("id").primaryKey(),
  matchId: text("match_id")
    .notNull()
    .references(() => matchesTable.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  role: text("role"),
  alive: boolean("alive").notNull().default(true),
  won: boolean("won").notNull().default(false),
});

export type Match = typeof matchesTable.$inferSelect;
export type InsertMatch = typeof matchesTable.$inferInsert;
export type MatchPlayer = typeof matchPlayersTable.$inferSelect;
export type InsertMatchPlayer = typeof matchPlayersTable.$inferInsert;
