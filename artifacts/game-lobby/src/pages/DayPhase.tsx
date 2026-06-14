import type { Player, Role } from "@/App";
import { useCountdown } from "@/hooks/useCountdown";

type Props = {
  subPhase: "day-discussion" | "day-vote";
  players: Player[];
  mySocketId: string;
  myRole: Role | null;
  timerEndsAt: number | null;
  dayVotes: Record<string, number>;
  myDayVote: string | null;
  onDayVote: (targetId: string) => void;
};

export default function DayPhase({
  subPhase,
  players,
  mySocketId,
  myRole,
  timerEndsAt,
  dayVotes,
  myDayVote,
  onDayVote,
}: Props) {
  const countdown = useCountdown(timerEndsAt);
  const me = players.find((p) => p.id === mySocketId);
  const amAlive = me?.alive ?? false;
  const isVoting = subPhase === "day-vote";

  const livingPlayers = players.filter((p) => p.alive);
  const votableTargets = livingPlayers.filter((p) => p.id !== mySocketId);

  const countdownColor =
    countdown > 20 ? "text-gray-300" : countdown > 8 ? "text-amber-400" : "text-red-400";

  const totalVotes = Object.values(dayVotes).reduce((a, b) => a + b, 0);

  return (
    <div
      className="min-h-screen flex flex-col items-center px-4 py-10"
      style={{ background: "#1a1208" }}
    >
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="text-lg">☀️</span>
            <div>
              <h1 className="text-xl font-bold text-amber-100 tracking-wide">
                {isVoting ? "VOTE" : "DAY"}
              </h1>
              <p className="text-xs text-amber-700 font-medium">
                {isVoting ? "Eliminate a suspect" : "Discuss amongst yourselves"}
              </p>
            </div>
          </div>
          <div className={`text-2xl font-mono font-bold tabular-nums ${countdownColor}`}>
            {countdown}s
          </div>
        </div>

        {!amAlive && (
          <div className="bg-gray-900/60 border border-gray-700 rounded-xl px-4 py-3 mb-4 text-center">
            <p className="text-gray-400 text-sm">You're eliminated — watch the discussion.</p>
          </div>
        )}

        {!isVoting ? (
          <div className="flex flex-col gap-4">
            <div className="bg-amber-950/30 border border-amber-900/40 rounded-xl px-4 py-4 text-center">
              <p className="text-amber-200 text-sm leading-relaxed">
                Discuss who you think the Mafia might be. Voting begins when the timer ends.
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-3 font-medium">
                Living players ({livingPlayers.length})
              </p>
              <div className="flex flex-col gap-2">
                {players.map((player) => (
                  <div
                    key={player.id}
                    className={`flex items-center gap-3 min-h-[48px] px-4 rounded-xl border transition-opacity ${
                      player.alive
                        ? "bg-gray-900 border-gray-800"
                        : "bg-gray-950 border-gray-900 opacity-40"
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        player.alive ? "bg-gray-700 text-gray-300" : "bg-gray-800 text-gray-600"
                      }`}
                    >
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <span className={`text-sm font-medium ${player.alive ? "text-white" : "text-gray-600 line-through"}`}>
                      {player.name}
                      {player.id === mySocketId && (
                        <span className="text-gray-500 text-xs ml-1 font-normal no-underline">(you)</span>
                      )}
                    </span>
                    {player.isHost && player.alive && (
                      <span className="ml-auto text-xs text-amber-500 opacity-60">HOST</span>
                    )}
                    {myRole === "mafia" && player.id !== mySocketId && !player.alive === false && (
                      <span className="ml-auto text-xs text-red-700 opacity-50">mafia</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {!amAlive ? (
              <div className="bg-gray-900/60 border border-gray-700 rounded-xl px-4 py-4">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-3 font-medium">Live votes</p>
                <VoteTally players={votableTargets} dayVotes={dayVotes} totalVotes={totalVotes} />
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1 font-medium">
                  Vote to eliminate — {totalVotes} vote{totalVotes !== 1 ? "s" : ""} cast
                </p>
                {votableTargets.map((player) => {
                  const voteCount = dayVotes[player.id] ?? 0;
                  const isSelected = myDayVote === player.id;
                  const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;

                  return (
                    <button
                      key={player.id}
                      onClick={() => onDayVote(player.id)}
                      className={`w-full min-h-[60px] px-4 rounded-xl flex items-center gap-3 transition-all text-left border relative overflow-hidden ${
                        isSelected
                          ? "bg-amber-900/40 border-amber-600 shadow-[0_0_12px_rgba(217,119,6,0.2)]"
                          : "bg-gray-900 border-gray-800 hover:border-gray-600 hover:bg-gray-800"
                      }`}
                    >
                      {totalVotes > 0 && (
                        <div
                          className="absolute inset-0 opacity-10 bg-amber-500 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      )}
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 z-10 ${
                          isSelected ? "bg-amber-600 text-white" : "bg-gray-700 text-gray-300"
                        }`}
                      >
                        {player.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-white font-medium text-base z-10">{player.name}</span>
                      <div className="ml-auto flex items-center gap-2 z-10">
                        {voteCount > 0 && (
                          <span className={`text-sm font-bold ${isSelected ? "text-amber-300" : "text-gray-400"}`}>
                            {voteCount}
                          </span>
                        )}
                        {isSelected && (
                          <span className="text-amber-400 text-xs font-semibold">VOTED ✓</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function VoteTally({
  players,
  dayVotes,
  totalVotes,
}: {
  players: Player[];
  dayVotes: Record<string, number>;
  totalVotes: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      {players.map((p) => {
        const count = dayVotes[p.id] ?? 0;
        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        return (
          <div key={p.id} className="flex items-center gap-2">
            <span className="text-gray-300 text-sm w-20 truncate">{p.name}</span>
            <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-gray-500 text-xs w-6 text-right">{count}</span>
          </div>
        );
      })}
    </div>
  );
}
