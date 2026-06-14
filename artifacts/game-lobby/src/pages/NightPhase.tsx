import type { Player, Role } from "@/App";
import { useCountdown } from "@/hooks/useCountdown";

type Props = {
  players: Player[];
  mySocketId: string;
  myRole: Role;
  mafiaIds: string[];
  nightVoteStatus: { voted: number; total: number };
  myNightVote: string | null;
  timerEndsAt: number | null;
  onNightVote: (targetId: string) => void;
};

export default function NightPhase({
  players,
  mySocketId,
  myRole,
  mafiaIds,
  nightVoteStatus,
  myNightVote,
  timerEndsAt,
  onNightVote,
}: Props) {
  const countdown = useCountdown(timerEndsAt);
  const isMafia = myRole === "mafia";
  const me = players.find((p) => p.id === mySocketId);
  const amAlive = me?.alive ?? false;

  const targets = players.filter(
    (p) => p.alive && p.id !== mySocketId && !mafiaIds.includes(p.id),
  );

  const countdownColor =
    countdown > 15 ? "text-gray-300" : countdown > 5 ? "text-amber-400" : "text-red-400";

  return (
    <div
      className="min-h-screen flex flex-col items-center px-4 py-10"
      style={{ background: "#060812" }}
    >
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="text-lg">🌙</span>
            <h1 className="text-xl font-bold text-gray-100 tracking-wide">NIGHT</h1>
          </div>
          <div className={`text-2xl font-mono font-bold tabular-nums ${countdownColor}`}>
            {countdown}s
          </div>
        </div>

        {!amAlive && (
          <div className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 mb-4 text-center">
            <p className="text-gray-400 text-sm">You were eliminated. Watch how the night unfolds.</p>
          </div>
        )}

        {isMafia && amAlive ? (
          <>
            <div className="bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3 mb-5 text-center">
              <p className="text-red-400 text-xs font-semibold uppercase tracking-widest mb-0.5">Mafia</p>
              <p className="text-gray-300 text-sm">Choose who to eliminate tonight</p>
            </div>

            <div className="flex flex-col gap-2 mb-6">
              {targets.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-4">No valid targets.</p>
              ) : (
                targets.map((player) => {
                  const isSelected = myNightVote === player.id;
                  return (
                    <button
                      key={player.id}
                      onClick={() => onNightVote(player.id)}
                      className={`w-full min-h-[56px] px-4 rounded-xl flex items-center gap-3 transition-all text-left border ${
                        isSelected
                          ? "bg-red-900/60 border-red-600 shadow-[0_0_12px_rgba(220,38,38,0.3)]"
                          : "bg-gray-900 border-gray-800 hover:border-gray-600 hover:bg-gray-800"
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                          isSelected ? "bg-red-600 text-white" : "bg-gray-700 text-gray-300"
                        }`}
                      >
                        {player.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-white font-medium text-base">{player.name}</span>
                      {isSelected && (
                        <span className="ml-auto text-red-400 text-xs font-semibold">TARGET ✓</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div className="text-center">
              <p className="text-gray-600 text-xs">
                {nightVoteStatus.voted} of {nightVoteStatus.total} Mafia{" "}
                {nightVoteStatus.voted === 1 ? "has" : "have"} voted
              </p>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-5xl mb-6 opacity-60">😴</div>
            <h2 className="text-lg font-semibold text-gray-300 mb-2">The town sleeps…</h2>
            <p className="text-gray-500 text-sm max-w-xs leading-relaxed">
              The Mafia moves in the shadows. Stay calm and wait for dawn.
            </p>
            {nightVoteStatus.total > 0 && (
              <p className="mt-6 text-gray-700 text-xs">
                {nightVoteStatus.voted} of {nightVoteStatus.total} Mafia{" "}
                {nightVoteStatus.voted === 1 ? "has" : "have"} voted
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
