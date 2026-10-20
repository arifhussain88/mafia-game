import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { matchesTable } from "./matches";
import { usersTable } from "./users";

export const chatMessagesTable = pgTable("chat_messages", {
  id: text("id").primaryKey(),
  roomCode: text("room_code").notNull(),
  matchId: text("match_id").references(() => matchesTable.id, { onDelete: "set null" }),
  userId: text("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ChatMessageRow = typeof chatMessagesTable.$inferSelect;
export type InsertChatMessage = typeof chatMessagesTable.$inferInsert;
