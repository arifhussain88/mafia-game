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
    countdown > 15 ? "text-gray-400" : countdown > 5 ? "text-amber-400" : "text-red-400";

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-10" style={{ background: "#060710" }}>
      <div className="w-full max-w-sm">

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <span className="text-xl">🌙</span>
            <div>
              <h1 className="text-xl font-bold text-gray-200 tracking-widest">NIGHT</h1>
              {isMafia && amAlive && (
                <p className="text-xs text-red-500 font-medium">Choose your target</p>
              )}
            </div>
          </div>
          <div className={`text-3xl font-mono font-bold tabular-nums ${countdownColor}`}>
            {countdown}s
          </div>
        </div>

        {!amAlive && (
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl px-4 py-3 mb-5 text-center">
            <p className="text-gray-500 text-sm">You're eliminated — watching.</p>
          </div>
        )}

        {isMafia && amAlive ? (
          <>
            <div className="flex flex-col gap-2 mb-6">
              {targets.length === 0 ? (
                <p className="text-center text-gray-600 text-sm py-4">No valid targets.</p>
              ) : (
                targets.map((player) => {
                  const isSelected = myNightVote === player.id;
                  return (
                    <button
                      key={player.id}
                      onClick={() => onNightVote(player.id)}
                      className={`w-full min-h-[60px] px-4 rounded-xl flex items-center gap-3 transition-all text-left border ${
                        isSelected
                          ? "bg-red-950/60 border-red-700 shadow-[0_0_16px_rgba(185,28,28,0.2)]"
                          : "bg-gray-900/60 border-gray-800 hover:border-gray-600"
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                          isSelected ? "bg-red-700 text-white" : "bg-gray-800 text-gray-400"
                        }`}
                      >
                        {player.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-white font-medium text-base">{player.name}</span>
                      {!player.connected && (
                        <span className="ml-1 text-xs text-gray-600">(offline)</span>
                      )}
                      {isSelected && (
                        <span className="ml-auto text-red-400 text-xs font-bold tracking-wide">TARGET ✓</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <p className="text-center text-gray-700 text-xs">
              {nightVoteStatus.voted} of {nightVoteStatus.total} Mafia{" "}
              {nightVoteStatus.voted === 1 ? "has" : "have"} voted
            </p>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-6 opacity-40 select-none">😴</div>
            <h2 className="text-lg font-semibold text-gray-400 mb-2">The town sleeps…</h2>
            <p className="text-gray-600 text-sm max-w-xs leading-relaxed">
              The Mafia moves in the shadows. Wait for dawn.
            </p>
            <p className="mt-8 text-gray-700 text-xs">
              {nightVoteStatus.voted > 0
                ? `${nightVoteStatus.voted} of ${nightVoteStatus.total} Mafia ${nightVoteStatus.voted === 1 ? "has" : "have"} voted`
                : ""}
            </p>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-gray-900">
          <div className="flex flex-wrap gap-2">
            {players.map((p) => (
              <div
                key={p.id}
                className={`text-xs px-2 py-1 rounded-full border ${
                  !p.alive
                    ? "border-gray-800 text-gray-700 line-through"
                    : !p.connected
                    ? "border-gray-800 text-gray-600"
                    : isMafia && mafiaIds.includes(p.id)
                    ? "border-red-900/50 text-red-600 bg-red-950/20"
                    : "border-gray-800 text-gray-500"
                }`}
              >
                {p.name}{!p.connected && p.alive ? " ·" : ""}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
