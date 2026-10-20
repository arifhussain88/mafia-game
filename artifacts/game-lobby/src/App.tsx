import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import Home from "@/pages/Home";
import Lobby, { DEFAULT_TIMER_SETTINGS, type TimerSettings } from "@/pages/Lobby";
import MatchCountdown from "@/pages/MatchCountdown";
import RoleReveal from "@/pages/RoleReveal";
import NightPhase from "@/pages/NightPhase";
import NightSummary from "@/pages/NightSummary";
import EliminationReveal from "@/pages/EliminationReveal";
import DayPhase from "@/pages/DayPhase";
import GameOver from "@/pages/GameOver";
import MuteToggle from "@/components/MuteToggle";
import Atmosphere from "@/components/Atmosphere";
import LeaveMatchButton from "@/components/LeaveMatchButton";
import MatchTicker from "@/components/MatchTicker";
import RoomChat from "@/components/RoomChat";
import { playNightSting, playDayChime, playMafiaKill, startAmbientLoop, stopAmbientLoop, unlockAudio, isMuted } from "@/lib/audio";

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
  | "match-countdown"
  | "role-reveal"
  | "night-mafia"
  | "night-doctor"
  | "night-detective"
  | "night-summary"
  | "day-discussion"
  | "day-vote"
  | "day-result"
  | "game-over";

function isActiveMatchPhase(phase: GamePhase): boolean {
  return phase !== "home" && phase !== "lobby" && phase !== "game-over";
}

export default function App() {
  const socketRef = useRef<Socket | null>(null);
  const prevPhaseRef = useRef<GamePhase>("home");
  const phaseRef = useRef<GamePhase>("home");
  const leaveSentRef = useRef(false);
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
  const [timerSettings, setTimerSettings] = useState<TimerSettings>(DEFAULT_TIMER_SETTINGS);

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
  const [chatMessages, setChatMessages] = useState<{ id: string; name: string; text: string }[]>([]);
  const blockedNamesRef = useRef<Set<string>>(new Set());

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
  const [tickerMessage, setTickerMessage] = useState<string | null>(null);
  const tickerSeqRef = useRef(0);

  function showTicker(text: string) {
    tickerSeqRef.current += 1;
    setTickerMessage(`${text}\u200B${tickerSeqRef.current}`);
  }

  // Phase transition sounds — ignore first transition from "home"
  useEffect(() => {
    phaseRef.current = phase;
    if (phase === "lobby" || phase === "home") leaveSentRef.current = false;
    if (phase === prevPhaseRef.current) return;
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    if (phase === "night-mafia" && prev !== "home") playNightSting();
    if (phase === "day-discussion") playDayChime();
  }, [phase]);

  function resetToHome() {
    leaveSentRef.current = true;
    setPhase("home");
    setPlayers([]);
    setRoomCode("");
    setIsHost(false);
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
    setChatMessages([]);
    blockedNamesRef.current = new Set();
    setDayNarration(null);
    setDetectiveResult(null);
    setNightSummaryLines([]);
    setElimInfo(null);
    setWinner(null);
    setGameOverPlayers([]);
    setTickerMessage(null);
  }

  const leaveMatch = useCallback(() => {
    if (leaveSentRef.current) return;
    leaveSentRef.current = true;
    socketRef.current?.emit("leave-game");
    resetToHome();
  }, []);

  useEffect(() => {
    function emitLeaveIfNeeded() {
      if (!isActiveMatchPhase(phaseRef.current) || leaveSentRef.current) return;
      leaveSentRef.current = true;
      socketRef.current?.emit("leave-game");
    }
    function onPageHide(event: PageTransitionEvent) {
      // bfcache / tab switch — treat as soft disconnect, not forfeit
      if (event.persisted) return;
      emitLeaveIfNeeded();
    }
    function onBeforeUnload() {
      emitLeaveIfNeeded();
    }
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  // Ambient loop on the opening screen, in the lobby, and after the game ends.
  useEffect(() => {
    const ambientActive = phase === "home" || phase === "lobby" || phase === "game-over";
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
    const ambientActive = phase === "home" || phase === "lobby" || phase === "game-over";
    if (!ambientActive) return;

    function unlockOnGesture() {
      unlockAudio();
      if (!isMuted()) startAmbientLoop();
    }

    window.addEventListener("pointerdown", unlockOnGesture);
    window.addEventListener("keydown", unlockOnGesture);
    return () => {
      window.removeEventListener("pointerdown", unlockOnGesture);
      window.removeEventListener("keydown", unlockOnGesture);
    };
  }, [phase]);

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
    setChatMessages([]);
    blockedNamesRef.current = new Set();
    setDayNarration(null);
    setDetectiveResult(null);
    setNightSummaryLines([]);
    setElimInfo(null);
    setWinner(null);
    setGameOverPlayers([]);
    setPhase("lobby");
  }

  useEffect(() => {
    let token: string | null = null;
    try { token = localStorage.getItem("mafia-token"); } catch { token = null; }

    const socket = io({
      path: "/socket.io",
      auth: token ? { token } : {},
      autoConnect: Boolean(token),
    });
    socketRef.current = socket;

    socket.on("connect", () => setMySocketId(socket.id ?? ""));

    socket.on("connect_error", (err) => {
      if (err.message === "Unauthorized" || /unauthorized/i.test(err.message)) {
        try {
          localStorage.removeItem("mafia-token");
          localStorage.removeItem("mafia-user");
        } catch {}
        setIsAuthenticated(false);
        setPhase("home");
        toast({ title: "Session expired", description: "Please sign in again.", variant: "destructive" });
        return;
      }
      toast({ title: "Connection issue", description: "Trying to reconnect…" });
    });

    socket.io.on("reconnect", () => {
      toast({ title: "Back online", description: "Connection restored." });
    });

    socket.on("disconnect", (reason) => {
      if (reason === "io client disconnect") return;
      toast({ title: "Disconnected", description: "Reconnecting…" });
    });

    socket.on("room-created", (data: { code: string; players: Player[]; isHost: boolean; timerSettings?: TimerSettings }) => {
      setRoomCode(data.code);
      setPlayers(data.players);
      setIsHost(data.isHost);
      if (data.timerSettings) setTimerSettings(data.timerSettings);
      setPhase("lobby");
    });

    socket.on("room-joined", (data: { code: string; players: Player[]; isHost: boolean; timerSettings?: TimerSettings }) => {
      setRoomCode(data.code);
      setPlayers(data.players);
      setIsHost(data.isHost);
      if (data.timerSettings) setTimerSettings(data.timerSettings);
      setPhase("lobby");
    });

    socket.on("timer-settings", (data: { timerSettings: TimerSettings }) => {
      setTimerSettings(data.timerSettings);
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

    socket.on("mafia-kill-sound", () => {
      playMafiaKill();
    });

    socket.on("day-vote-update", (data: { votes: Record<string, number> }) => {
      setDayVotes(data.votes);
    });

    socket.on("chat-message", (data: { id: string; name: string; text: string }) => {
      if (blockedNamesRef.current.has(data.name)) return;
      setChatMessages((current) => [...current, data]);
    });

    socket.on("chat-history", (data: { messages: { id: string; name: string; text: string }[] }) => {
      const blocked = blockedNamesRef.current;
      setChatMessages((data.messages ?? []).filter((m) => !blocked.has(m.name)));
    });

    socket.on("player-left", (data: { name: string }) => {
      showTicker(`${data.name} left the game`);
    });

    socket.on("player-rejoined", (data: { name: string }) => {
      showTicker(`${data.name} rejoined the game`);
    });

    socket.on("left-game", () => {
      resetToHome();
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
  const updateTimerSettings = useCallback((next: TimerSettings) => {
    setTimerSettings(next);
    socketRef.current?.emit("set-timer-settings", next);
  }, []);
  const castNightVote       = useCallback((id: string) => { setMyNightVote(id); socketRef.current?.emit("night-vote", { targetId: id }); }, []);
  const castDoctorProtect   = useCallback((id: string) => { socketRef.current?.emit("doctor-protect", { targetId: id }); }, []);
  const castDetectiveInvest = useCallback((id: string) => { socketRef.current?.emit("detective-investigate", { targetId: id }); }, []);
  const castDayVote         = useCallback((id: string) => { setMyDayVote(id); socketRef.current?.emit("day-vote", { targetId: id }); }, []);
  const sendChat            = useCallback((text: string) => { socketRef.current?.emit("send-chat", { text }); }, []);
  const reportChat          = useCallback((id: string) => {
    socketRef.current?.emit("report-chat", { id });
    toast({ title: "Reported", description: "Thanks — we'll review this message." });
  }, [toast]);
  const blockPlayer         = useCallback((name: string) => {
    blockedNamesRef.current.add(name);
    socketRef.current?.emit("block-player", { name });
    setChatMessages((current) => current.filter((m) => m.name !== name));
    toast({ title: "Blocked", description: `${name} is hidden from your chat.` });
  }, [toast]);
  const playAgain           = useCallback(() => { socketRef.current?.emit("play-again"); }, []);
  const beginDay            = useCallback(() => { socketRef.current?.emit("begin-day"); }, []);

  // Connect socket once the user authenticates on the home screen
  useEffect(() => {
    if (!isAuthenticated) return;
    const socket = socketRef.current;
    if (!socket) return;
    let token: string | null = null;
    try { token = localStorage.getItem("mafia-token"); } catch { token = null; }
    if (!token) return;
    socket.auth = { token };
    if (!socket.connected) socket.connect();
  }, [isAuthenticated]);


  const isNightPhase = phase === "night-mafia" || phase === "night-doctor" || phase === "night-detective";

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
          onLogout={() => {
            setIsAuthenticated(false);
            socketRef.current?.disconnect();
          }}
        />
      )}

      {phase === "lobby" && (
        <Lobby
          roomCode={roomCode}
          players={players}
          isHost={isHost}
          mySocketId={mySocketId}
          timerSettings={timerSettings}
          onStartGame={startGame}
          onKickPlayer={kickPlayer}
          onTimerSettingsChange={updateTimerSettings}
        />
      )}

      {phase === "match-countdown" && (
        <MatchCountdown players={players} timerEndsAt={timerEndsAt} />
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
        <NightSummary lines={nightSummaryLines} />
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

      {isActiveMatchPhase(phase) && <LeaveMatchButton onConfirm={leaveMatch} />}
      {phase !== "home" && (
        <RoomChat
          myName={myName}
          messages={chatMessages}
          onSend={sendChat}
          onReport={reportChat}
          onBlock={blockPlayer}
        />
      )}
      <MatchTicker message={tickerMessage} />
      <MuteToggle />
      <Toaster />
    </div>
  );
}
