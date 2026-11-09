import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { getDb, hasDatabaseUrl, matchPlayersTable, matchesTable } from "@workspace/db";
import { DbUnavailableError, getUserForToken, readStore } from "../lib/user-store";

/** Your own stats for the Home strip and Profile screen. Only you can read them. */
const router = Router();

type Row = {
  role: string | null;
  won: boolean;
  outcome: string | null;
  saves: number;
  mafiaFound: number;
  kills: number;
  endedAt: Date;
  winner: string;
};

const ROLES = ["mafia", "detective", "doctor", "civilian"] as const;
const HISTORY_LIMIT = 500;

async function loadRows(userId: string): Promise<Row[]> {
  if (!hasDatabaseUrl()) {
    const rows: Row[] = [];
    for (const m of readStore().matches ?? []) {
      for (const p of m.players) {
        if (p.userId !== userId) continue;
        rows.push({ ...p, endedAt: new Date(m.endedAt), winner: m.winner });
      }
    }
    return rows.sort((a, b) => b.endedAt.getTime() - a.endedAt.getTime()).slice(0, HISTORY_LIMIT);
  }
  try {
    return await getDb()
      .select({
        role: matchPlayersTable.role,
        won: matchPlayersTable.won,
        outcome: matchPlayersTable.outcome,
        saves: matchPlayersTable.saves,
        mafiaFound: matchPlayersTable.mafiaFound,
        kills: matchPlayersTable.kills,
        endedAt: matchesTable.endedAt,
        winner: matchesTable.winner,
      })
      .from(matchPlayersTable)
      .innerJoin(matchesTable, eq(matchPlayersTable.matchId, matchesTable.id))
      .where(eq(matchPlayersTable.userId, userId))
      .orderBy(desc(matchesTable.endedAt))
      .limit(HISTORY_LIMIT);
  } catch (err) {
    throw new DbUnavailableError(err instanceof Error ? err.message : "Database unavailable");
  }
}

const pct = (wins: number, games: number) => (games ? Math.round((wins / games) * 100) : 0);

/** One line that makes a role's record feel personal. */
function highlight(role: string, rows: Row[]): string {
  const n = (k: "saves" | "mafiaFound" | "kills") => rows.reduce((sum, r) => sum + (r[k] ?? 0), 0);
  const times = (x: number) => (x === 1 ? "once" : `${x} times`);
  switch (role) {
    case "detective": {
      const found = n("mafiaFound");
      return found ? `caught the Mafia ${times(found)}` : "still hunting for the Mafia";
    }
    case "doctor": {
      const saves = n("saves");
      return saves ? `saved ${saves} ${saves === 1 ? "life" : "lives"}` : "no saves yet";
    }
    case "mafia": {
      const wins = rows.filter((r) => r.won).length;
      return wins ? `won ${wins} ${wins === 1 ? "game" : "games"} as Mafia` : `${n("kills")} night hits so far`;
    }
    default: {
      const survived = rows.filter((r) => r.outcome === "survived").length;
      return `survived ${survived} of ${rows.length}`;
    }
  }
}

router.get("/me", async (req, res) => {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  try {
    const user = await getUserForToken(token);
    if (!user || user.bannedAt) return res.status(401).json({ message: "Please sign in again" });

    const rows = await loadRows(user.id);
    const games = rows.length;
    const wins = rows.filter((r) => r.won).length;
    let streak = 0;
    for (const r of rows) {
      if (!r.won) break;
      streak += 1;
    }

    const byRole = ROLES.map((role) => {
      const rr = rows.filter((r) => r.role === role);
      const w = rr.filter((r) => r.won).length;
      return { role, games: rr.length, wins: w, winRate: pct(w, rr.length) };
    });
    // Best role: highest win rate among roles played at least twice; else the most played.
    const played = byRole.filter((r) => r.games > 0);
    const candidates = played.filter((r) => r.games >= 2);
    const bestRole = (candidates.length ? candidates : played).sort(
      (a, b) => b.winRate - a.winRate || b.games - a.games,
    )[0];

    return res.json({
      name: user.name,
      since: user.createdAt,
      totals: { games, wins, winRate: pct(wins, games), streak },
      byRole,
      best: bestRole
        ? { ...bestRole, highlight: highlight(bestRole.role, rows.filter((r) => r.role === bestRole.role)) }
        : null,
      recent: rows.slice(0, 5).map((r) => ({
        role: r.role,
        result: r.winner === "draw" ? "draw" : r.won ? "won" : "lost",
        outcome: r.outcome ?? "survived",
        endedAt: r.endedAt.toISOString(),
      })),
    });
  } catch (err) {
    if (err instanceof DbUnavailableError) return res.status(503).json({ message: "Service temporarily unavailable. Try again." });
    throw err;
  }
});

export default router;
