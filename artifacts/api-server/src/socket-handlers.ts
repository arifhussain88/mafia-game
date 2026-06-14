import { Server, Socket } from "socket.io";
import { logger } from "./lib/logger";

interface Player {
  id: string;
  name: string;
  isHost: boolean;
}

interface Room {
  code: string;
  players: Map<string, Player>;
  started: boolean;
}

const rooms = new Map<string, Room>();

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function serializePlayers(players: Map<string, Player>): Player[] {
  return Array.from(players.values());
}

function removePlayerFromRooms(socketId: string, io: Server) {
  for (const [code, room] of rooms.entries()) {
    if (!room.players.has(socketId)) continue;

    const wasHost = room.players.get(socketId)!.isHost;
    room.players.delete(socketId);

    if (room.players.size === 0) {
      rooms.delete(code);
      logger.info({ code }, "Room deleted — no players left");
      return;
    }

    if (wasHost) {
      const newHost = room.players.values().next().value!;
      newHost.isHost = true;
      logger.info({ code, newHostId: newHost.id }, "Host transferred");
    }

    io.to(code).emit("players-updated", { players: serializePlayers(room.players) });
    logger.info({ code, socketId }, "Player left room");
    return;
  }
}

export function registerSocketHandlers(io: Server) {
  io.on("connection", (socket: Socket) => {
    logger.info({ socketId: socket.id }, "Socket connected");

    socket.on("create-room", (data: { name: string }) => {
      const name = (data?.name ?? "").trim();
      if (!name) {
        socket.emit("room-error", { message: "Display name is required" });
        return;
      }

      let code = generateCode();
      while (rooms.has(code)) code = generateCode();

      const player: Player = { id: socket.id, name, isHost: true };
      const room: Room = {
        code,
        players: new Map([[socket.id, player]]),
        started: false,
      };
      rooms.set(code, room);

      socket.join(code);
      socket.emit("room-created", {
        code,
        players: serializePlayers(room.players),
        isHost: true,
      });
      logger.info({ code, name }, "Room created");
    });

    socket.on("join-room", (data: { code: string; name: string }) => {
      const code = (data?.code ?? "").trim().toUpperCase();
      const name = (data?.name ?? "").trim();

      if (!code) {
        socket.emit("room-error", { message: "Room code is required" });
        return;
      }
      if (!name) {
        socket.emit("room-error", { message: "Display name is required" });
        return;
      }

      const room = rooms.get(code);
      if (!room) {
        socket.emit("room-error", { message: "Room not found. Check your code." });
        return;
      }
      if (room.started) {
        socket.emit("room-error", { message: "This game has already started." });
        return;
      }

      const nameTaken = Array.from(room.players.values()).some(
        (p) => p.name.toLowerCase() === name.toLowerCase(),
      );
      if (nameTaken) {
        socket.emit("room-error", { message: "That name is already taken in this room." });
        return;
      }

      const player: Player = { id: socket.id, name, isHost: false };
      room.players.set(socket.id, player);

      socket.join(code);

      socket.emit("room-joined", {
        code,
        players: serializePlayers(room.players),
        isHost: false,
      });

      socket.to(code).emit("players-updated", { players: serializePlayers(room.players) });
      logger.info({ code, name }, "Player joined room");
    });

    socket.on("start-game", () => {
      for (const [code, room] of rooms.entries()) {
        const player = room.players.get(socket.id);
        if (!player) continue;

        if (!player.isHost) {
          socket.emit("room-error", { message: "Only the host can start the game." });
          return;
        }
        if (room.players.size < 4) {
          socket.emit("room-error", { message: "Need at least 4 players to start." });
          return;
        }

        room.started = true;
        io.to(code).emit("game-started", { code });
        logger.info({ code, playerCount: room.players.size }, "Game started");
        return;
      }
    });

    socket.on("disconnect", () => {
      removePlayerFromRooms(socket.id, io);
      logger.info({ socketId: socket.id }, "Socket disconnected");
    });
  });
}
