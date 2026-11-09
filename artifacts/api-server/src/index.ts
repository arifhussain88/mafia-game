import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { ensureSchema, hasDatabaseUrl } from "@workspace/db";
import { purgeOldReports } from "./lib/moderation";
import app from "./app";
import { logger } from "./lib/logger";
import { registerSocketHandlers } from "./socket-handlers";

const rawPort = process.env["PORT"] || "8080";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Same-origin by default (web client and WebView app load the game from this host).
// Set CORS_ORIGIN (comma-separated) only if a frontend is hosted elsewhere.
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : false;

const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  path: "/socket.io",
  maxHttpBufferSize: 16 * 1024,
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"],
  },
});

registerSocketHandlers(io);

// A stray throw must never take down the process: every room lives in memory,
// so a crash ends every match in progress. Log and keep serving.
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection");
});
process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception");
});

// In production only Caddy (same host) should reach Node; bind to loopback so
// port 8080 is never exposed directly even if a firewall rule opens it.
const host =
  process.env.HOST?.trim() || (process.env.NODE_ENV === "production" ? "127.0.0.1" : "0.0.0.0");

// Startup failures (e.g. port already in use) must still exit so systemd or
// the developer sees it, instead of a process that lingers serving nothing.
httpServer.on("error", (err) => {
  logger.fatal({ err, port, host }, "HTTP server failed to start");
  process.exit(1);
});

// Bring the database up to date (new tables/columns) before serving, then
// keep report retention to the 12 months promised in the privacy policy.
try {
  await ensureSchema();
} catch (err) {
  logger.error({ err }, "Schema upgrade failed; continuing (features needing it will error)");
}
void purgeOldReports();
setInterval(() => void purgeOldReports(), 24 * 60 * 60 * 1000).unref();

httpServer.listen(port, host, () => {
  const authStore = hasDatabaseUrl() ? "neon" : "json";
  logger.info({ port, host, authStore }, "Server listening");
});
