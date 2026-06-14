import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import Home from "@/pages/Home";
import Lobby from "@/pages/Lobby";
import GameStarted from "@/pages/GameStarted";

export type Player = {
  id: string;
  name: string;
  isHost: boolean;
};

export type Screen = "home" | "lobby" | "game";

export default function App() {
  const socketRef = useRef<Socket | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [roomCode, setRoomCode] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [mySocketId, setMySocketId] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const socket = io({ path: "/socket.io" });
    socketRef.current = socket;

    socket.on("connect", () => {
      setMySocketId(socket.id ?? "");
    });

    socket.on("room-created", (data: { code: string; players: Player[]; isHost: boolean }) => {
      setRoomCode(data.code);
      setPlayers(data.players);
      setIsHost(data.isHost);
      setScreen("lobby");
    });

    socket.on("room-joined", (data: { code: string; players: Player[]; isHost: boolean }) => {
      setRoomCode(data.code);
      setPlayers(data.players);
      setIsHost(data.isHost);
      setScreen("lobby");
    });

    socket.on("players-updated", (data: { players: Player[] }) => {
      setPlayers(data.players);
    });

    socket.on("game-started", () => {
      setScreen("game");
    });

    socket.on("room-error", (data: { message: string }) => {
      toast({ title: "Error", description: data.message, variant: "destructive" });
    });

    return () => {
      socket.disconnect();
    };
  }, [toast]);

  const createRoom = useCallback((name: string) => {
    socketRef.current?.emit("create-room", { name });
  }, []);

  const joinRoom = useCallback((code: string, name: string) => {
    socketRef.current?.emit("join-room", { code, name });
  }, []);

  const startGame = useCallback(() => {
    socketRef.current?.emit("start-game");
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {screen === "home" && (
        <Home onCreateRoom={createRoom} onJoinRoom={joinRoom} />
      )}
      {screen === "lobby" && (
        <Lobby
          roomCode={roomCode}
          players={players}
          isHost={isHost}
          mySocketId={mySocketId}
          onStartGame={startGame}
        />
      )}
      {screen === "game" && (
        <GameStarted roomCode={roomCode} players={players} />
      )}
      <Toaster />
    </div>
  );
}
