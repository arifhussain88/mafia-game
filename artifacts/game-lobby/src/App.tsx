import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import Home from "@/pages/Home";
import Lobby from "@/pages/Lobby";
import RoleReveal from "@/pages/RoleReveal";
import NightPhase from "@/pages/NightPhase";
import NightSummary from "@/pages/NightSummary";
import EliminationReveal from "@/pages/EliminationReveal";
import DayPhase from "@/pages/DayPhase";
import GameOver from "@/pages/GameOver";
import MuteToggle from "@/components/MuteToggle";
import Atmosphere from "@/components/Atmosphere";
import { playNightSting, playDayChime, startAmbientLoop, stopAmbientLoop, unlockAudio, isMuted } from "@/lib/audio";

export type Role = "mafia" | "civilian" | "doctor" | "detective";

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
  | "night-mafia"
  | "night-doctor"
  | "night-detective"
  | "night-summary"
  | "day-discussion"
  | "day-vote"
  | "day-result"
  | "game-over";

export default function App() {
  const socketRef = useRef<Socket | null>(null);
  const prevPhaseRef = useRef<GamePhase>("home");
  const { toast } = useToast();

  const [mySocketId, setMySocketId] = useState("");
  const [myName, setMyName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [phase, setPhase] = useState<GamePhase>("home");
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    try { return Boolean(localStorage.getItem("mafia-token")); } catch { return false; }
  });
  const [players, setPlayers] = useState<Player[]>([]);

  const [myRole, setMyRole] = useState<Role | null>(null);
  const [mafiaNames, setMafiaNames] = useState<string[]>([]);
  const [mafiaIds, setMafiaIds] = useState<string[]>([]);

  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);
  const [nightVoteStatus, setNightVoteStatus] = useState({ voted: 0, total: 0 });
  const [myNightVote, setMyNightVote] = useState<string | null>(null);
  const [myDoctorVote, setMyDoctorVote] = useState<string | null>(null);
  const [myDetectiveVote, setMyDetectiveVote] = useState<string | null>(null);

  const [dayVotes, setDayVotes] = useState<Record<string, number>>({});
  const [myDayVote, setMyDayVote] = useState<string | null>(null);

  const [dayNarration, setDayNarration] = useState<string | null>(null);
  const [detectiveResult, setDetectiveResult] = useState<{
    targetName: string;
    isMafia: boolean;
  } | null>(null);

  const [nightSummaryLines, setNightSummaryLines] = useState<string[]>([]);

  const [elimInfo, setElimInfo] = useState<{
    name: string | null;
    skipped?: boolean;
    phase: "day-result";
  } | null>(null);

  const [winner, setWinner] = useState<"mafia" | "civilians" | null>(null);
  const [gameOverPlayers, setGameOverPlayers] = useState<Player[]>([]);

  // Phase transition sounds — ignore first transition from "home"
  useEffect(() => {
    if (phase === prevPhaseRef.current) return;
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    if (phase === "night-mafia" && prev !== "home") playNightSting();
    if (phase === "day-discussion") playDayChime();
  }, [phase]);

  // Ambient loop plays only in the lobby and after the game ends.
  useEffect(() => {
    const ambientActive = isAuthenticated && (phase === "home" || phase === "lobby" || phase === "game-over");
    if (ambientActive && !isMuted()) {
      unlockAudio();
      startAmbientLoop();
    } else {
      stopAmbientLoop();
    }

    function onMuteChange(e: Event) {
      const detail = (e as CustomEvent<boolean>).detail;
      const shouldStart = ambientActive && !detail;
      if (shouldStart) {
        unlockAudio();
        startAmbientLoop();
      } else stopAmbientLoop();
    }

    window.addEventListener("mafia-muted-changed", onMuteChange as EventListener);
    return () => window.removeEventListener("mafia-muted-changed", onMuteChange as EventListener);
  }, [phase]);

  useEffect(() => {
    const ambientActive = isAuthenticated && (phase === "home" || phase === "lobby" || phase === "game-over");

    function unlockOnGesture() {
      if (ambientActive) {
        unlockAudio();
        if (!isMuted()) startAmbientLoop();
      }
    }

    window.addEventListener("pointerdown", unlockOnGesture, { once: true });
    window.addEventListener("keydown", unlockOnGesture, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlockOnGesture);
      window.removeEventListener("keydown", unlockOnGesture);
    };
  }, [phase, isAuthenticated]);

  function resetForLobby(newPlayers: Player[], socketId: string) {
    setPlayers(newPlayers);
    const me = newPlayers.find((p) => p.id === socketId);
    if (me) setIsHost(me.isHost);
    setMyRole(null);
    setMafiaNames([]);
    setMafiaIds([]);
    setTimerEndsAt(null);
    setNightVoteStatus({ voted: 0, total: 0 });
    setMyNightVote(null);
    setMyDoctorVote(null);
    setMyDetectiveVote(null);
    setDayVotes({});
    setMyDayVote(null);
    setDayNarration(null);
    setDetectiveResult(null);
    setNightSummaryLines([]);
    setElimInfo(null);
    setWinner(null);
    setGameOverPlayers([]);
    setPhase("lobby");
  }

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
      (data: { phase: GamePhase; endsAt: number; players: Player[]; votes?: Record<string, number>; narration?: string }) => {
        setPhase(data.phase);
        setPlayers(data.players);
        setTimerEndsAt(data.endsAt);

        if (data.phase === "night-mafia") {
          setMyNightVote(null);
          setMyDoctorVote(null);
          setMyDetectiveVote(null);
          setDetectiveResult(null);
          setNightVoteStatus({ voted: 0, total: 0 });
        }
        if (data.phase === "day-vote") {
          setDayVotes(data.votes ?? {});
          setMyDayVote(null);
        }
        if (data.phase === "day-discussion") {
          setDayVotes({});
          setDayNarration(data.narration ?? null);
        }
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
        toast({ title: "Reconnected", description: "You've rejoined the game." });
      },
    );

    socket.on("night-vote-status", (data: { voted: number; total: number }) => {
      setNightVoteStatus(data);
    });

    socket.on("doctor-protect-ack", (data: { targetId: string }) => {
      setMyDoctorVote(data.targetId);
    });

    socket.on("detective-investigate-ack", (data: { targetId: string }) => {
      setMyDetectiveVote(data.targetId);
    });

    socket.on("detective-result", (data: { targetName: string; isMafia: boolean }) => {
      setDetectiveResult(data);
    });

    socket.on(
      "night-summary",
      (data: { lines: string[]; eliminatedId: string | null; players: Player[] }) => {
        setNightSummaryLines(data.lines);
        setPlayers(data.players);
        setPhase("night-summary");
      },
    );

    socket.on("day-vote-update", (data: { votes: Record<string, number> }) => {
      setDayVotes(data.votes);
    });

    socket.on(
      "day-result",
      (data: { eliminatedId: string | null; eliminatedName: string | null; skipped: boolean; players: Player[] }) => {
        setPhase("day-result");
        setPlayers(data.players);
        setElimInfo({ name: data.eliminatedName, skipped: data.skipped, phase: "day-result" });
      },
    );

    socket.on("game-over", (data: { winner: "mafia" | "civilians"; players: Player[] }) => {
      setWinner(data.winner);
      setGameOverPlayers(data.players);
      setPhase("game-over");
    });

    socket.on("room-reset", (data: { players: Player[] }) => {
      resetForLobby(data.players, socket.id ?? "");
    });

    socket.on("room-error", (data: { message: string }) => {
      toast({ title: "Error", description: data.message, variant: "destructive" });
    });

    return () => { socket.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createRoom = useCallback((name: string) => {
    unlockAudio();
    setMyName(name);
    socketRef.current?.emit("create-room", { name });
  }, []);

  const joinRoom = useCallback((code: string, name: string) => {
    unlockAudio();
    setMyName(name);
    socketRef.current?.emit("join-room", { code, name });
  }, []);

  const startGame           = useCallback(() => { socketRef.current?.emit("start-game"); }, []);
  const kickPlayer          = useCallback((id: string) => { socketRef.current?.emit("kick-player", { targetId: id }); }, []);
  const castNightVote       = useCallback((id: string) => { setMyNightVote(id); socketRef.current?.emit("night-vote", { targetId: id }); }, []);
  const castDoctorProtect   = useCallback((id: string) => { socketRef.current?.emit("doctor-protect", { targetId: id }); }, []);
  const castDetectiveInvest = useCallback((id: string) => { socketRef.current?.emit("detective-investigate", { targetId: id }); }, []);
  const castDayVote         = useCallback((id: string) => { setMyDayVote(id); socketRef.current?.emit("day-vote", { targetId: id }); }, []);
  const playAgain           = useCallback(() => { socketRef.current?.emit("play-again"); }, []);
  const beginDay            = useCallback(() => { socketRef.current?.emit("begin-day"); }, []);

  const isNightPhase = phase === "night-mafia" || phase === "night-doctor" || phase === "night-detective";
  // show mute in lobby and gameplay
  const showMuteToggle = phase !== "home" || isAuthenticated;

  return (
    <div className="game-shell min-h-screen text-gray-100 relative z-0">
      <Atmosphere phase={phase} />
      {phase === "home" && (
        <Home
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          onAuthenticated={() => {
            setIsAuthenticated(true);
            unlockAudio();
            if (!isMuted()) startAmbientLoop();
          }}
        />
      )}

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

      {isNightPhase && myRole && (
        <NightPhase
          phase={phase as "night-mafia" | "night-doctor" | "night-detective"}
          players={players}
          mySocketId={mySocketId}
          myRole={myRole}
          mafiaIds={mafiaIds}
          nightVoteStatus={nightVoteStatus}
          myNightVote={myNightVote}
          myDoctorVote={myDoctorVote}
          myDetectiveVote={myDetectiveVote}
          timerEndsAt={timerEndsAt}
          detectiveResult={myRole === "detective" ? detectiveResult : null}
          onNightVote={castNightVote}
          onDoctorProtect={castDoctorProtect}
          onDetectiveInvestigate={castDetectiveInvest}
        />
      )}

      {phase === "night-summary" && (
        <NightSummary
          lines={nightSummaryLines}
        />
      )}

      {phase === "day-result" && elimInfo && (
        <EliminationReveal
          eliminatedName={elimInfo.name}
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
          narration={dayNarration}
          detectiveResult={myRole === "detective" ? detectiveResult : null}
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

      {showMuteToggle && <MuteToggle />}
      <Toaster />
    </div>
  );
}
