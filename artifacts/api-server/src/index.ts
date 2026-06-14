import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import app from "./app";
import { logger } from "./lib/logger";
import { registerSocketHandlers } from "./socket-handlers";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  path: "/socket.io",
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

registerSocketHandlers(io);

httpServer.listen(port, () => {
  logger.info({ port }, "Server listening");
});
