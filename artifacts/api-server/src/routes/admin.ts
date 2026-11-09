import { Router, type NextFunction, type Request, type Response } from "express";
import crypto from "crypto";
import { listReports, setBanned, setReportStatus } from "../lib/moderation";
import { DbUnavailableError, findUserByEmail } from "../lib/user-store";
import { disconnectUser } from "../socket-handlers";

/**
 * Moderation endpoints for the developer. Disabled (404) unless ADMIN_TOKEN is
 * set on the server; a wrong token also gets 404 so the API isn't advertised.
 *
 *   curl -H "Authorization: Bearer $ADMIN_TOKEN" https://<host>/api/admin/reports
 */
const router = Router();

function tokenMatches(given: string | undefined): boolean {
  const expected = process.env.ADMIN_TOKEN?.trim();
  if (!expected || expected.length < 24 || !given) return false;
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : undefined;
  if (!tokenMatches(token)) {
    res.status(404).json({ message: "Not found" });
    return;
  }
  next();
}

router.use(requireAdmin);

function dbDown(res: Response, err: unknown) {
  if (err instanceof DbUnavailableError) return res.status(503).json({ message: "Database unavailable" });
  throw err;
}

router.get("/reports", async (req, res) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : "open";
    const limit = Number(req.query.limit) || 100;
    res.json({ reports: await listReports(status === "all" ? undefined : status, limit) });
  } catch (err) {
    dbDown(res, err);
  }
});

router.post("/reports/:id/status", async (req, res) => {
  const status = req.body?.status;
  if (!["open", "resolved", "dismissed"].includes(status)) {
    return res.status(400).json({ message: "status must be open, resolved or dismissed" });
  }
  try {
    const ok = await setReportStatus(String(req.params.id), status);
    return ok ? res.json({ ok: true }) : res.status(404).json({ message: "No such report" });
  } catch (err) {
    return dbDown(res, err);
  }
});

async function resolveUserId(body: { userId?: unknown; email?: unknown }): Promise<string | null> {
  if (typeof body.userId === "string" && body.userId) return body.userId;
  if (typeof body.email === "string" && body.email) return (await findUserByEmail(body.email))?.id ?? null;
  return null;
}

router.post("/ban", async (req, res) => {
  try {
    const userId = await resolveUserId(req.body ?? {});
    if (!userId) return res.status(404).json({ message: "No such user" });
    const reason = typeof req.body?.reason === "string" ? req.body.reason : undefined;
    if (!(await setBanned(userId, true, reason))) return res.status(404).json({ message: "No such user" });
    disconnectUser(userId, "Your account has been suspended.");
    req.log?.warn({ userId }, "Account suspended by admin");
    return res.json({ ok: true });
  } catch (err) {
    return dbDown(res, err);
  }
});

router.post("/unban", async (req, res) => {
  try {
    const userId = await resolveUserId(req.body ?? {});
    if (!userId || !(await setBanned(userId, false))) return res.status(404).json({ message: "No such user" });
    req.log?.info({ userId }, "Suspension lifted by admin");
    return res.json({ ok: true });
  } catch (err) {
    return dbDown(res, err);
  }
});

export default router;
