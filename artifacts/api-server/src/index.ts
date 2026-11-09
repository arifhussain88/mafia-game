import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { hasDatabaseUrl } from "@workspace/db";
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

httpServer.listen(port, "0.0.0.0", () => {
  const authStore = hasDatabaseUrl() ? "neon" : "json";
  logger.info({ port, host: "0.0.0.0", authStore }, "Server listening");
});
