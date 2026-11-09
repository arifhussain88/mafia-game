import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Player and chat reports (Play UGC policy). No foreign keys on purpose:
 * reports are kept for up to 12 months even after an involved account is
 * deleted (see privacy.html), then purged.
 */
export const reportsTable = pgTable("reports", {
  id: text("id").primaryKey(),
  reporterId: text("reporter_id"),
  reporterName: text("reporter_name").notNull(),
  reportedId: text("reported_id"),
  reportedName: text("reported_name").notNull(),
  roomCode: text("room_code").notNull(),
  reason: text("reason").notNull(),
  message: text("message"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Report = typeof reportsTable.$inferSelect;
