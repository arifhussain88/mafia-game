import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import Home from "@/pages/Home";
import Lobby from "@/pages/Lobby";
import RoleReveal from "@/pages/RoleReveal";
import NightPhase from "@/pages/NightPhase";
import EliminationReveal from "@/pages/EliminationReveal";
import DayPhase from "@/pages/DayPhase";
import GameOver from "@/pages/GameOver";

export type Role = "mafia" | "civilian";

export type Player = {
  id: string;
  name: string;
  isHost: boolean;
  alive: boolean;
  connected: boolean;
  role?: Role;
};

export type GamePhase =
  | "home"
  | "lobby"
  | "role-reveal"
  | "night"
  | "night-result"
  | "day-discussion"
  | "day-vote"
  | "day-result"
  | "game-over";

function resetGameState(set: {
  setPhase: (p: GamePhase) => void;
  setMyRole: (r: Role | null) => void;
  setMafiaNames: (n: string[]) => void;
  setMafiaIds: (n: string[]) => void;
  setTimerEndsAt: (t: number | null) => void;
  setNightVoteStatus: (s: { voted: number; total: number }) => void;
  setMyNightVote: (v: string | null) => void;
  setDayVotes: (v: Record<string, number>) => void;
  setMyDayVote: (v: string | null) => void;
  setElimInfo: (e: null) => void;
  setWinner: (w: null) => void;
  setGameOverPlayers: (p: Player[]) => void;
  phase: GamePhase;
}) {
  set.setMyRole(null);
  set.setMafiaNames([]);
  set.setMafiaIds([]);
  set.setTimerEndsAt(null);
  set.setNightVoteStatus({ voted: 0, total: 0 });
  set.setMyNightVote(null);
  set.setDayVotes({});
  set.setMyDayVote(null);
  set.setElimInfo(null);
  set.setWinner(null);
  set.setGameOverPlayers([]);
  set.setPhase("lobby");
}

export default function App() {
  const socketRef = useRef<Socket | null>(null);
  const { toast } = useToast();

  const [mySocketId, setMySocketId] = useState("");
  const [myName, setMyName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [phase, setPhase] = useState<GamePhase>("home");
  const [players, setPlayers] = useState<Player[]>([]);

  const [myRole, setMyRole] = useState<Role | null>(null);
  const [mafiaNames, setMafiaNames] = useState<string[]>([]);
  const [mafiaIds, setMafiaIds] = useState<string[]>([]);

  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);
  const [nightVoteStatus, setNightVoteStatus] = useState({ voted: 0, total: 0 });
  const [myNightVote, setMyNightVote] = useState<string | null>(null);
  const [dayVotes, setDayVotes] = useState<Record<string, number>>({});
  const [myDayVote, setMyDayVote] = useState<string | null>(null);

  const [elimInfo, setElimInfo] = useState<{
    name: string | null;
    role: Role | null;
    skipped?: boolean;
    phase: "night-result" | "day-result";
  } | null>(null);

  const [winner, setWinner] = useState<"mafia" | "civilians" | null>(null);
  const [gameOverPlayers, setGameOverPlayers] = useState<Player[]>([]);

  const stateSetters = {
    setPhase, setMyRole, setMafiaNames, setMafiaIds, setTimerEndsAt,
    setNightVoteStatus, setMyNightVote, setDayVotes, setMyDayVote,
    setElimInfo, setWinner, setGameOverPlayers, phase,
  };

  useEffect(() => {
    const socket = io({ path: "/socket.io" });
    socketRef.current = socket;

    socket.on("connect", () => setMySocketId(socket.id ?? ""));

    socket.on("room-created", (data: { code: string; players: Player[]; isHost: boolean }) => {
      setRoomCode(data.code);
      setPlayers(data.players);
      setIsHost(data.isHost);
      setPhase("lobby");
    });

    socket.on("room-joined", (data: { code: string; players: Player[]; isHost: boolean }) => {
      setRoomCode(data.code);
      setPlayers(data.players);
      setIsHost(data.isHost);
      setPhase("lobby");
    });

    socket.on("players-updated", (data: { players: Player[] }) => {
      setPlayers(data.players);
      // Update isHost in case it transferred
      const me = data.players.find((p) => p.id === socket.id);
      if (me) setIsHost(me.isHost);
    });

    socket.on("kicked", () => {
      toast({ title: "Removed", description: "The host removed you from the room.", variant: "destructive" });
      setPhase("home");
      setPlayers([]);
      setRoomCode("");
    });

    socket.on("role-assigned", (data: { role: Role; mafiaNames: string[]; mafiaIds: string[] }) => {
      setMyRole(data.role);
      setMafiaNames(data.mafiaNames);
      setMafiaIds(data.mafiaIds);
    });

    socket.on(
      "game-phase",
      (data: { phase: GamePhase; endsAt: number; players: Player[]; votes?: Record<string, number> }) => {
        setPhase(data.phase);
        setPlayers(data.players);
        setTimerEndsAt(data.endsAt);
        if (data.phase === "night") setMyNightVote(null);
        if (data.phase === "day-vote") { setDayVotes(data.votes ?? {}); setMyDayVote(null); }
        if (data.phase === "day-discussion") setDayVotes({});
      },
    );

    socket.on(
      "reconnected",
      (data: { code: string; phase: GamePhase; endsAt: number; players: Player[]; isHost: boolean }) => {
        setRoomCode(data.code);
        setPlayers(data.players);
        setIsHost(data.isHost);
        setTimerEndsAt(data.endsAt);
        setPhase(data.phase);
        // role-assigned event follows separately
        toast({ title: "Reconnected", description: "You've rejoined the game." });
      },
    );

    socket.on("night-vote-status", (data: { voted: number; total: number }) => {
      setNightVoteStatus(data);
    });

    socket.on("day-vote-update", (data: { votes: Record<string, number> }) => {
      setDayVotes(data.votes);
    });

    socket.on(
      "night-result",
      (data: { eliminatedId: string; eliminatedName: string; eliminatedRole: Role; players: Player[] }) => {
        setPhase("night-result");
        setPlayers(data.players);
        setElimInfo({ name: data.eliminatedName, role: data.eliminatedRole, phase: "night-result" });
      },
    );

    socket.on(
      "day-result",
      (data: { eliminatedId: string | null; eliminatedName: string | null; eliminatedRole: Role | null; skipped: boolean; players: Player[] }) => {
        setPhase("day-result");
        setPlayers(data.players);
        setElimInfo({ name: data.eliminatedName, role: data.eliminatedRole, skipped: data.skipped, phase: "day-result" });
      },
    );

    socket.on("game-over", (data: { winner: "mafia" | "civilians"; players: Player[] }) => {
      setWinner(data.winner);
      setGameOverPlayers(data.players);
      setPhase("game-over");
    });

    socket.on("room-reset", (data: { players: Player[] }) => {
      setPlayers(data.players);
      const me = data.players.find((p) => p.id === socket.id);
      if (me) setIsHost(me.isHost);
      resetGameState(stateSetters);
    });

    socket.on("room-error", (data: { message: string }) => {
      toast({ title: "Error", description: data.message, variant: "destructive" });
    });

    return () => { socket.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createRoom = useCallback((name: string) => {
    setMyName(name);
    socketRef.current?.emit("create-room", { name });
  }, []);

  const joinRoom = useCallback((code: string, name: string) => {
    setMyName(name);
    socketRef.current?.emit("join-room", { code, name });
  }, []);

  const startGame = useCallback(() => { socketRef.current?.emit("start-game"); }, []);
  const kickPlayer = useCallback((targetId: string) => { socketRef.current?.emit("kick-player", { targetId }); }, []);
  const castNightVote = useCallback((targetId: string) => { setMyNightVote(targetId); socketRef.current?.emit("night-vote", { targetId }); }, []);
  const castDayVote = useCallback((targetId: string) => { setMyDayVote(targetId); socketRef.current?.emit("day-vote", { targetId }); }, []);
  const playAgain = useCallback(() => { socketRef.current?.emit("play-again"); }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {phase === "home" && <Home onCreateRoom={createRoom} onJoinRoom={joinRoom} />}
      {phase === "lobby" && (
        <Lobby
          roomCode={roomCode}
          players={players}
          isHost={isHost}
          mySocketId={mySocketId}
          onStartGame={startGame}
          onKickPlayer={kickPlayer}
        />
      )}
      {phase === "role-reveal" && myRole && (
        <RoleReveal role={myRole} mafiaNames={mafiaNames} myName={myName} />
      )}
      {phase === "night" && myRole && (
        <NightPhase
          players={players}
          mySocketId={mySocketId}
          myRole={myRole}
          mafiaIds={mafiaIds}
          nightVoteStatus={nightVoteStatus}
          myNightVote={myNightVote}
          timerEndsAt={timerEndsAt}
          onNightVote={castNightVote}
        />
      )}
      {(phase === "night-result" || phase === "day-result") && elimInfo && (
        <EliminationReveal
          phase={elimInfo.phase}
          eliminatedName={elimInfo.name}
          eliminatedRole={elimInfo.role}
          skipped={elimInfo.skipped}
        />
      )}
      {(phase === "day-discussion" || phase === "day-vote") && (
        <DayPhase
          subPhase={phase}
          players={players}
          mySocketId={mySocketId}
          myRole={myRole}
          mafiaIds={mafiaIds}
          timerEndsAt={timerEndsAt}
          dayVotes={dayVotes}
          myDayVote={myDayVote}
          onDayVote={castDayVote}
        />
      )}
      {phase === "game-over" && winner && (
        <GameOver
          winner={winner}
          players={gameOverPlayers}
          mySocketId={mySocketId}
          isHost={isHost}
          onPlayAgain={playAgain}
        />
      )}
      <Toaster />
    </div>
  );
}
