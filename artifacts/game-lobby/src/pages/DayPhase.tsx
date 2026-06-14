import type { Player, Role } from "@/App";
import { useCountdown } from "@/hooks/useCountdown";

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
  const me = players.find((p) => p.id === mySocketId);
  const amAlive = me?.alive ?? false;
  const isVoting = subPhase === "day-vote";

  const livingPlayers = players.filter((p) => p.alive);
  const votableTargets = livingPlayers.filter((p) => p.id !== mySocketId);
  const totalVotes = Object.values(dayVotes).reduce((a, b) => a + b, 0);

  const countdownColor =
    countdown > 20 ? "text-gray-400" : countdown > 8 ? "text-amber-400" : "text-red-400";

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-10" style={{ background: "#120e08" }}>
      <div className="w-full max-w-sm">

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-xl">☀️</span>
            <div>
              <h1 className="text-xl font-bold text-amber-100 tracking-widest">
                {isVoting ? "VOTE" : "DAY"}
              </h1>
              <p className="text-xs text-amber-800 font-medium">
                {isVoting ? "Who is the Mafia?" : "Discuss before the vote"}
              </p>
            </div>
          </div>
          <div className={`text-3xl font-mono font-bold tabular-nums ${countdownColor}`}>
            {countdown}s
          </div>
        </div>

        {/* Narration banner — public, shown at start of day */}
        {narration && !isVoting && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-gray-900/70 border border-gray-700">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Last Night</p>
            <p className="text-gray-200 text-sm leading-relaxed">{narration}</p>
          </div>
        )}

        {/* Detective result — private, only visible to detective */}
        {detectiveResult && !isVoting && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-amber-950/30 border border-amber-700/40">
            <p className="text-xs font-semibold text-amber-500 uppercase tracking-widest mb-1">
              🔍 Your investigation
            </p>
            <p className="text-amber-100 text-sm leading-relaxed">
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
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl px-4 py-3 mb-4 text-center">
            <p className="text-gray-500 text-sm">You're eliminated — watching.</p>
          </div>
        )}

        {!isVoting ? (
          /* Discussion view */
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-widest mb-3 font-medium">
                Players alive ({livingPlayers.length})
              </p>
              <div className="flex flex-col gap-2">
                {players.map((player) => {
                  const isMe = player.id === mySocketId;
                  const isFellowMafia = myRole === "mafia" && mafiaIds.includes(player.id) && !isMe;
                  return (
                    <div
                      key={player.id}
                      className={`flex items-center gap-3 min-h-[52px] px-4 rounded-xl border ${
                        player.alive ? "bg-gray-900/60 border-gray-800" : "bg-gray-950 border-gray-900 opacity-30"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${player.alive ? "bg-gray-700 text-gray-300" : "bg-gray-800 text-gray-600"}`}>
                        {player.name.charAt(0).toUpperCase()}
                      </div>
                      <span className={`text-sm font-medium flex-1 ${player.alive ? "text-white" : "text-gray-600 line-through"}`}>
                        {player.name}
                        {isMe && <span className="text-gray-600 text-xs ml-1">(you)</span>}
                        {!player.connected && player.alive && <span className="text-gray-600 text-xs ml-1">(offline)</span>}
                      </span>
                      {isFellowMafia && (
                        <span className="text-xs text-red-800 font-medium">mafia</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* Voting view */
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-600 uppercase tracking-widest font-medium">Cast your vote</p>
              {totalVotes > 0 && (
                <p className="text-xs text-gray-600 font-mono">
                  {totalVotes} vote{totalVotes !== 1 ? "s" : ""} cast
                </p>
              )}
            </div>

            {!amAlive ? (
              votableTargets.map((player) => {
                const count = dayVotes[player.id] ?? 0;
                const pct = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
                return (
                  <div key={player.id} className="flex items-center gap-3 min-h-[48px] px-4 py-2 rounded-xl bg-gray-900/60 border border-gray-800">
                    <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300 flex-shrink-0">
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-white text-sm font-medium w-20 truncate">{player.name}</span>
                    <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-600 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-gray-500 text-xs font-mono w-4 text-right">{count}</span>
                  </div>
                );
              })
            ) : (
              votableTargets.map((player) => {
                const voteCount = dayVotes[player.id] ?? 0;
                const isSelected = myDayVote === player.id;
                const pct = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;

                return (
                  <button
                    key={player.id}
                    onClick={() => onDayVote(player.id)}
                    className={`w-full min-h-[64px] px-4 rounded-xl flex items-center gap-3 transition-all text-left border relative overflow-hidden ${
                      isSelected
                        ? "bg-amber-950/50 border-amber-600/60 shadow-[0_0_16px_rgba(180,83,9,0.15)]"
                        : "bg-gray-900/60 border-gray-800 hover:border-gray-600"
                    }`}
                  >
                    {pct > 0 && (
                      <div
                        className="absolute inset-0 bg-amber-600/8 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    )}
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 z-10 ${isSelected ? "bg-amber-700 text-white" : "bg-gray-800 text-gray-400"}`}>
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-white font-medium text-base z-10 flex-1">{player.name}</span>
                    <div className="flex items-center gap-2 z-10">
                      {voteCount > 0 && (
                        <span className={`text-sm font-bold font-mono ${isSelected ? "text-amber-400" : "text-gray-500"}`}>
                          {voteCount}
                        </span>
                      )}
                      {isSelected && (
                        <span className="text-amber-400 text-xs font-bold tracking-wide">VOTED ✓</span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
