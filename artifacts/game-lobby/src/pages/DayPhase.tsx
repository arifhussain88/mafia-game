import { useEffect, useRef } from "react";
import type { Player, Role } from "@/App";
import { useCountdown } from "@/hooks/useCountdown";
import { useCircleSize } from "@/hooks/useCircleSize";
import { playTimerAlert } from "@/lib/audio";
import PlayerCircle, { type ActionMode } from "@/components/PlayerCircle";

type Props = {
  subPhase: "day-discussion" | "day-vote";
  players: Player[];
  mySocketId: string;
  myRole: Role | null;
  mafiaIds: string[];
  timerEndsAt: number | null;
  dayVotes: Record<string, number>;
  myDayVote: string | null;
  narration: string | null;
  detectiveResult: { targetName: string; isMafia: boolean } | null;
  onDayVote: (targetId: string) => void;
};

export default function DayPhase({
  subPhase,
  players,
  mySocketId,
  myRole,
  mafiaIds,
  timerEndsAt,
  dayVotes,
  myDayVote,
  narration,
  detectiveResult,
  onDayVote,
}: Props) {
  const countdown = useCountdown(timerEndsAt);
  const alertFiredRef = useRef(false);
  const circleSize = useCircleSize();

  useEffect(() => {
    if (countdown <= 8 && countdown > 0 && !alertFiredRef.current) {
      alertFiredRef.current = true;
      playTimerAlert();
    }
    if (countdown > 15) alertFiredRef.current = false;
  }, [countdown]);

  const me = players.find((p) => p.id === mySocketId);
  const amAlive = me?.alive ?? false;
  const isVoting = subPhase === "day-vote";

  const actionMode: ActionMode = isVoting && amAlive ? "day-vote" : "none";

  const totalVotes = Object.values(dayVotes).reduce((a, b) => a + b, 0);

  const countdownCls =
    countdown > 20 ? "text-gray-400" : countdown > 8 ? "text-amber-400" : "text-red-400";

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-6 md:py-10">

      {/* Header */}
      <div className="w-full max-w-sm md:max-w-2xl mb-3 md:mb-4">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <span className="text-xl md:text-2xl">☀️</span>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-amber-100 tracking-widest">
                {isVoting ? "VOTE" : "DAY"}
              </h1>
              <p className="text-xs md:text-sm text-amber-800 font-medium">
                {isVoting ? "Tap a player to vote them out" : "Discuss — then vote begins"}
              </p>
            </div>
          </div>
          <div className={`text-3xl md:text-4xl font-mono font-bold tabular-nums ${countdownCls}`}>
            {countdown}s
          </div>
        </div>
      </div>

      {/* Info banners */}
      <div className="w-full max-w-sm md:max-w-lg flex flex-col gap-3 mb-3 md:mb-5">
        {narration && (
          <div className="w-full px-4 py-3 rounded-xl bg-gray-900/70 border border-gray-700">
            <p className="text-[10px] md:text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Last Night</p>
            <p className="text-gray-200 text-sm md:text-base leading-relaxed">{narration}</p>
          </div>
        )}

        {detectiveResult && (
          <div className="w-full px-4 py-3 rounded-xl bg-amber-950/30 border border-amber-700/40">
            <p className="text-[10px] md:text-xs font-semibold text-amber-500 uppercase tracking-widest mb-1">
              🔍 Your investigation
            </p>
            <p className="text-amber-100 text-sm md:text-base leading-relaxed">
              <span className="font-semibold">{detectiveResult.targetName}</span>{" "}
              {detectiveResult.isMafia ? (
                <span className="text-red-400 font-semibold">is Mafia.</span>
              ) : (
                <span className="text-emerald-400 font-semibold">is not Mafia.</span>
              )}
            </p>
            <p className="text-amber-800 text-xs mt-1">Only you can see this.</p>
          </div>
        )}

        {!amAlive && (
          <div className="w-full px-4 py-2 rounded-xl bg-gray-900/50 border border-gray-800 text-center">
            <p className="text-gray-500 text-sm md:text-base">You're eliminated — watching.</p>
          </div>
        )}
      </div>

      {/* Circle */}
      <PlayerCircle
        players={players}
        mySocketId={mySocketId}
        myRole={myRole}
        mafiaIds={mafiaIds}
        selectedId={isVoting ? myDayVote : null}
        actionMode={actionMode}
        onSelect={onDayVote}
        circleSize={circleSize}
      />

      {/* Vote status below circle */}
      <div className="w-full max-w-sm md:max-w-lg text-center min-h-[28px] flex flex-col items-center justify-center gap-1 mt-3">
        {isVoting && totalVotes > 0 && (
          <p className="text-amber-800 text-xs md:text-sm font-mono">
            {totalVotes} vote{totalVotes !== 1 ? "s" : ""} cast so far
          </p>
        )}
        {isVoting && amAlive && myDayVote && (
          <p className="text-amber-600 text-xs md:text-sm">
            Vote cast — you cannot change it.
          </p>
        )}
        {isVoting && amAlive && !myDayVote && (
          <p className="text-gray-600 text-xs md:text-sm">Tap a player card to vote.</p>
        )}
        {!isVoting && (
          <p className="text-gray-700 text-xs md:text-sm">
            {countdown > 20 ? "Discuss with your team." : "Voting begins soon…"}
          </p>
        )}
      </div>
    </div>
  );
}
