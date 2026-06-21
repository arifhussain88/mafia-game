import { useEffect, useRef } from "react";
import type { Player, Role } from "@/App";
import { useCountdown } from "@/hooks/useCountdown";
import { useCircleSize } from "@/hooks/useCircleSize";
import { playTimerAlert } from "@/lib/audio";
import PlayerCircle, { type ActionMode } from "@/components/PlayerCircle";

type NightStep = "night-mafia" | "night-doctor" | "night-detective";

type Props = {
  phase: NightStep;
  players: Player[];
  mySocketId: string;
  myRole: Role;
  mafiaIds: string[];
  nightVoteStatus: { voted: number; total: number };
  myNightVote: string | null;
  myDoctorVote: string | null;
  myDetectiveVote: string | null;
  timerEndsAt: number | null;
  detectiveResult: { targetName: string; isMafia: boolean } | null;
  onNightVote: (targetId: string) => void;
  onDoctorProtect: (targetId: string) => void;
  onDetectiveInvestigate: (targetId: string) => void;
};

const STEP_ROLE: Record<NightStep, Role> = {
  "night-mafia":     "mafia",
  "night-doctor":    "doctor",
  "night-detective": "detective",
};

const ROLE_LABEL: Record<Role, string> = {
  mafia:     "THE MAFIA",
  doctor:    "THE DOCTOR",
  detective: "THE DETECTIVE",
  civilian:  "CIVILIAN",
};

const ROLE_COLOR: Record<Role, string> = {
  mafia:     "#dc2626",
  doctor:    "#10b981",
  detective: "#f59e0b",
  civilian:  "#6b7280",
};

const INSTRUCTION: Record<NightStep, string> = {
  "night-mafia":     "Choose your target — tap a player to mark them for elimination.",
  "night-doctor":    "Choose someone to protect tonight — you may protect yourself.",
  "night-detective": "Choose a player to investigate.",
};

export default function NightPhase({
  phase,
  players,
  mySocketId,
  myRole,
  mafiaIds,
  nightVoteStatus,
  myNightVote,
  myDoctorVote,
  myDetectiveVote,
  timerEndsAt,
  detectiveResult,
  onNightVote,
  onDoctorProtect,
  onDetectiveInvestigate,
}: Props) {
  const countdown = useCountdown(timerEndsAt);
  const alertFiredRef = useRef(false);
  const circleSize = useCircleSize();

  const me = players.find((p) => p.id === mySocketId);
  const amAlive = me?.alive ?? false;
  const activeRole = STEP_ROLE[phase];
  const isMyTurn = myRole === activeRole && amAlive;

  useEffect(() => {
    if (!isMyTurn) return;
    if (countdown <= 8 && countdown > 0 && !alertFiredRef.current) {
      alertFiredRef.current = true;
      playTimerAlert();
    }
    if (countdown > 15) alertFiredRef.current = false;
  }, [countdown, isMyTurn]);

  // Active-role screen
  if (isMyTurn) {
    const roleColor = ROLE_COLOR[myRole];
    const detHasResult = myRole === "detective" && detectiveResult !== null;

    const actionMode: ActionMode = (() => {
      if (detHasResult) return "none";
      if (myRole === "mafia")     return "mafia-kill";
      if (myRole === "doctor")    return "doctor-protect";
      if (myRole === "detective") return "detective-investigate";
      return "none";
    })();

    const selectedId =
      myRole === "mafia"       ? myNightVote
      : myRole === "doctor"    ? myDoctorVote
      : myRole === "detective" ? myDetectiveVote
      : null;

    function handleSelect(targetId: string) {
      if (myRole === "mafia")     onNightVote(targetId);
      if (myRole === "doctor")    onDoctorProtect(targetId);
      if (myRole === "detective") onDetectiveInvestigate(targetId);
    }

    const countdownCls =
      countdown > 15 ? "text-gray-400" : countdown > 5 ? "text-amber-400" : "text-red-400";

    return (
      <div className="min-h-screen flex flex-col items-center px-4 py-6 md:py-10" style={{ background: "#060710" }}>

        {/* Header */}
        <div className="w-full max-w-sm md:max-w-2xl mb-3 md:mb-4">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <span className="text-xl md:text-2xl">🌙</span>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-gray-200 tracking-widest">NIGHT</h1>
                <p className="text-xs md:text-sm font-semibold tracking-wider" style={{ color: roleColor }}>
                  {ROLE_LABEL[myRole]}
                </p>
              </div>
            </div>
            <div className={`text-3xl md:text-4xl font-mono font-bold tabular-nums ${countdownCls}`}>
              {countdown}s
            </div>
          </div>
        </div>

        {/* Instruction */}
        <p className="text-xs md:text-sm text-center text-gray-500 mb-3 md:mb-5 max-w-sm md:max-w-lg">
          {detHasResult ? "Investigation complete." : INSTRUCTION[phase]}
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
          circleSize={circleSize}
        />

        {/* Status / detective inline result */}
        <div className="text-center min-h-[48px] flex flex-col items-center justify-center gap-1 w-full max-w-sm md:max-w-lg mt-3">
          {myRole === "detective" && detectiveResult && (
            <div
              className="rounded-xl border px-5 py-3 w-full"
              style={{
                background: detectiveResult.isMafia ? "rgba(127,0,0,0.18)" : "rgba(0,60,30,0.18)",
                borderColor: detectiveResult.isMafia ? "#7f1d1d" : "#134e2a",
              }}
            >
              <p className="text-xs md:text-sm text-gray-500 mb-1 uppercase tracking-widest">Investigation result</p>
              <p
                className="text-base md:text-lg font-bold"
                style={{ color: detectiveResult.isMafia ? "#ef4444" : "#34d399" }}
              >
                {detectiveResult.isMafia
                  ? `${detectiveResult.targetName} is Mafia.`
                  : `${detectiveResult.targetName} is not Mafia.`}
              </p>
              <p className="text-xs text-gray-600 mt-1">This result is yours alone. Never share it publicly.</p>
            </div>
          )}

          {myRole === "mafia" && !detHasResult && (
            <>
              {selectedId ? (
                <p className="text-red-700 text-xs md:text-sm">Target locked in — you can change it before time runs out.</p>
              ) : (
                <p className="text-gray-700 text-xs md:text-sm">No target selected yet.</p>
              )}
              {nightVoteStatus.total > 1 && (
                <p className="text-gray-700 text-xs md:text-sm">
                  {nightVoteStatus.voted} of {nightVoteStatus.total} Mafia{" "}
                  {nightVoteStatus.voted === 1 ? "has" : "have"} chosen
                </p>
              )}
            </>
          )}

          {myRole === "doctor" && selectedId && (
            <p className="text-emerald-700 text-xs md:text-sm">Protection chosen — you can change it before time runs out.</p>
          )}
        </div>

      </div>
    );
  }

  // Waiting screen
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "#060710" }}
    >
      <div className="flex flex-col items-center gap-8 text-center">
        <div className="relative">
          <div
            className="absolute inset-0 rounded-full animate-ping opacity-10"
            style={{ background: "#c8a04a", transform: "scale(1.6)" }}
          />
          <span className="text-5xl md:text-7xl relative">🌙</span>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-gray-400 text-lg md:text-2xl font-medium tracking-wide">
            The town is asleep…
          </p>
          <p className="text-gray-700 text-sm md:text-base">
            Stay quiet.
          </p>
        </div>

        <div className="flex gap-2 mt-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-gray-700 animate-pulse"
              style={{ animationDelay: `${i * 0.4}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
