import { useEffect, useRef } from "react";
import type { Player, Role } from "@/App";
import { useCountdown } from "@/hooks/useCountdown";
import { playTimerAlert } from "@/lib/audio";
import PlayerCircle, { type ActionMode } from "@/components/PlayerCircle";

type Props = {
  players: Player[];
  mySocketId: string;
  myRole: Role;
  mafiaIds: string[];
  nightVoteStatus: { voted: number; total: number };
  myNightVote: string | null;
  myDoctorVote: string | null;
  myDetectiveVote: string | null;
  timerEndsAt: number | null;
  onNightVote: (targetId: string) => void;
  onDoctorProtect: (targetId: string) => void;
  onDetectiveInvestigate: (targetId: string) => void;
};

const INSTRUCTION: Record<Role, string> = {
  mafia:     "Tap a player to choose your kill target",
  doctor:    "Tap anyone to protect them — you can protect yourself",
  detective: "Tap a player to investigate them tonight",
  civilian:  "Wait for dawn…",
};
const INSTRUCTION_COLOR: Record<Role, string> = {
  mafia:     "text-red-600/80",
  doctor:    "text-emerald-600/80",
  detective: "text-amber-600/70",
  civilian:  "text-gray-600",
};

export default function NightPhase({
  players,
  mySocketId,
  myRole,
  mafiaIds,
  nightVoteStatus,
  myNightVote,
  myDoctorVote,
  myDetectiveVote,
  timerEndsAt,
  onNightVote,
  onDoctorProtect,
  onDetectiveInvestigate,
}: Props) {
  const countdown = useCountdown(timerEndsAt);
  const alertFiredRef = useRef(false);

  useEffect(() => {
    if (countdown <= 8 && countdown > 0 && !alertFiredRef.current) {
      alertFiredRef.current = true;
      playTimerAlert();
    }
    if (countdown > 15) alertFiredRef.current = false;
  }, [countdown]);

  const me = players.find((p) => p.id === mySocketId);
  const amAlive = me?.alive ?? false;

  const actionMode: ActionMode = (() => {
    if (!amAlive) return "none";
    if (myRole === "mafia")     return "mafia-kill";
    if (myRole === "doctor")    return "doctor-protect";
    if (myRole === "detective") return "detective-investigate";
    return "none";
  })();

  const selectedId =
    myRole === "mafia"     ? myNightVote
    : myRole === "doctor"  ? myDoctorVote
    : myRole === "detective" ? myDetectiveVote
    : null;

  function handleSelect(targetId: string) {
    if (myRole === "mafia")     onNightVote(targetId);
    if (myRole === "doctor")    onDoctorProtect(targetId);
    if (myRole === "detective") onDetectiveInvestigate(targetId);
  }

  const countdownCls =
    countdown > 15 ? "text-gray-400" : countdown > 5 ? "text-amber-400" : "text-red-400";

  const subtitleColor: Record<Role, string> = {
    mafia:     "#ef4444",
    doctor:    "#34d399",
    detective: "#f59e0b",
    civilian:  "#6b7280",
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8" style={{ background: "#060710" }}>
      <div className="w-full max-w-sm flex flex-col items-center gap-4">

        {/* Header */}
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <span className="text-xl">🌙</span>
            <div>
              <h1 className="text-xl font-bold text-gray-200 tracking-widest">NIGHT</h1>
              <p
                className="text-xs font-medium"
                style={{ color: amAlive ? subtitleColor[myRole] : "#6b7280" }}
              >
                {amAlive ? subtitleColor && myRole : "Eliminated — spectating"}
              </p>
            </div>
          </div>
          <div className={`text-3xl font-mono font-bold tabular-nums ${countdownCls}`}>
            {countdown}s
          </div>
        </div>

        {/* Role instruction */}
        <p className={`text-xs text-center ${amAlive ? INSTRUCTION_COLOR[myRole] : "text-gray-700"}`}>
          {amAlive ? INSTRUCTION[myRole] : "You're eliminated — watching the night play out."}
        </p>

        {/* Circle */}
        <PlayerCircle
          players={players}
          mySocketId={mySocketId}
          myRole={myRole}
          mafiaIds={mafiaIds}
          selectedId={selectedId}
          actionMode={actionMode}
          onSelect={handleSelect}
        />

        {/* Status below circle */}
        <div className="text-center min-h-[32px] flex flex-col items-center justify-center gap-1">
          {myRole === "mafia" && amAlive && (
            <>
              {selectedId ? (
                <p className="text-red-700 text-xs">Target locked in — you can change it before time runs out.</p>
              ) : (
                <p className="text-gray-700 text-xs">No target selected yet.</p>
              )}
              <p className="text-gray-700 text-xs">
                {nightVoteStatus.voted} of {nightVoteStatus.total} Mafia{" "}
                {nightVoteStatus.voted === 1 ? "has" : "have"} voted
              </p>
            </>
          )}
          {myRole === "doctor" && amAlive && selectedId && (
            <p className="text-emerald-700 text-xs">Protection chosen — you can change it before time runs out.</p>
          )}
          {myRole === "detective" && amAlive && selectedId && (
            <p className="text-amber-700 text-xs">Target chosen — result arrives at dawn.</p>
          )}
          {!amAlive && nightVoteStatus.voted > 0 && (
            <p className="text-gray-700 text-xs">
              {nightVoteStatus.voted} of {nightVoteStatus.total} Mafia{" "}
              {nightVoteStatus.voted === 1 ? "has" : "have"} voted
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
