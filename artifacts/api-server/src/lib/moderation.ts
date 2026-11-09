import crypto from "crypto";
import { and, desc, eq, lt } from "drizzle-orm";
import { getDb, reportsTable, sessionsTable, usersTable } from "@workspace/db";
import { logger } from "./logger";
import { DbUnavailableError, readStore, usingDatabase, writeStore, type StoredReport } from "./user-store";

/** Reasons a player can pick when reporting. Anything else is stored as "other". */
export const REPORT_REASONS = ["harassment", "hate", "sexual", "cheating", "spam", "offensive-name", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Promised in privacy.html: reports and ban records are kept up to 12 months. */
const REPORT_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;

export function normaliseReason(reason: unknown): ReportReason {
  return (REPORT_REASONS as readonly string[]).includes(reason as string) ? (reason as ReportReason) : "other";
}

function wrap(err: unknown): never {
  throw new DbUnavailableError(err instanceof Error ? err.message : "Database unavailable");
}

export async function saveReport(input: Omit<StoredReport, "id" | "status" | "createdAt">): Promise<StoredReport> {
  const report: StoredReport = {
    ...input,
    message: input.message ? input.message.slice(0, 500) : null,
    id: crypto.randomUUID(),
    status: "open",
    createdAt: new Date().toISOString(),
  };
  if (!usingDatabase()) {
    const store = readStore();
    store.reports = [...(store.reports ?? []), report];
    writeStore(store);
    return report;
  }
  try {
    await getDb().insert(reportsTable).values({ ...report, createdAt: new Date(report.createdAt) });
    return report;
  } catch (err) {
    wrap(err);
  }
}

export async function listReports(status: string | undefined, limit = 100): Promise<StoredReport[]> {
  const cap = Math.min(Math.max(limit, 1), 500);
  if (!usingDatabase()) {
    const all = (readStore().reports ?? []).filter((r) => !status || r.status === status);
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, cap);
  }
  try {
    const rows = await getDb()
      .select()
      .from(reportsTable)
      .where(status ? eq(reportsTable.status, status) : undefined)
      .orderBy(desc(reportsTable.createdAt))
      .limit(cap);
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  } catch (err) {
    wrap(err);
  }
}

export async function setReportStatus(id: string, status: "open" | "resolved" | "dismissed"): Promise<boolean> {
  if (!usingDatabase()) {
    const store = readStore();
    const report = store.reports?.find((r) => r.id === id);
    if (!report) return false;
    report.status = status;
    writeStore(store);
    return true;
  }
  try {
    const rows = await getDb().update(reportsTable).set({ status }).where(eq(reportsTable.id, id)).returning({ id: reportsTable.id });
    return rows.length > 0;
  } catch (err) {
    wrap(err);
  }
}

/** Suspend (or lift a suspension on) an account. Banning also ends all its sessions. */
export async function setBanned(userId: string, banned: boolean, reason?: string): Promise<boolean> {
  const bannedAt = banned ? new Date() : null;
  const banReason = banned ? (reason ?? "Broke the community rules").slice(0, 200) : null;
  if (!usingDatabase()) {
    const store = readStore();
    const user = store.users.find((u) => u.id === userId);
    if (!user) return false;
    if (banned) {
      user.bannedAt = bannedAt!.toISOString();
      user.banReason = banReason!;
      for (const [token, s] of Object.entries(store.sessions)) if (s.userId === userId) delete store.sessions[token];
    } else {
      delete user.bannedAt;
      delete user.banReason;
    }
    writeStore(store);
    return true;
  }
  try {
    const db = getDb();
    const rows = await db.update(usersTable).set({ bannedAt, banReason }).where(eq(usersTable.id, userId)).returning({ id: usersTable.id });
    if (banned) await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
    return rows.length > 0;
  } catch (err) {
    wrap(err);
  }
}

/** Drop reports older than the retention window. Runs at boot and daily. */
export async function purgeOldReports(): Promise<void> {
  const cutoff = new Date(Date.now() - REPORT_RETENTION_MS);
  try {
    if (!usingDatabase()) {
      const store = readStore();
      const before = store.reports?.length ?? 0;
      store.reports = (store.reports ?? []).filter((r) => Date.parse(r.createdAt) >= cutoff.getTime());
      if (store.reports.length !== before) writeStore(store);
      return;
    }
    await getDb().delete(reportsTable).where(and(lt(reportsTable.createdAt, cutoff)));
  } catch (err) {
    logger.warn({ err }, "Report purge failed");
  }
}
