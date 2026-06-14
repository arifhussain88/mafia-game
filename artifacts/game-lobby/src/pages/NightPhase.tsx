import type { Player, Role } from "@/App";
import { useCountdown } from "@/hooks/useCountdown";

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

type TargetRowProps = {
  player: Player;
  isSelected: boolean;
  accentClass: string;
  selectedAccentClass: string;
  avatarClass: string;
  selectedLabel: string;
  onClick: () => void;
};

function TargetRow({ player, isSelected, accentClass, selectedAccentClass, avatarClass, selectedLabel, onClick }: TargetRowProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full min-h-[60px] px-4 rounded-xl flex items-center gap-3 transition-all text-left border ${
        isSelected ? accentClass : "bg-gray-900/60 border-gray-800 hover:border-gray-600"
      }`}
    >
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${isSelected ? avatarClass : "bg-gray-800 text-gray-400"}`}>
        {player.name.charAt(0).toUpperCase()}
      </div>
      <span className="text-white font-medium text-base">{player.name}</span>
      {!player.connected && <span className="text-xs text-gray-600 ml-1">(offline)</span>}
      {isSelected && (
        <span className={`ml-auto text-xs font-bold tracking-wide ${selectedAccentClass}`}>{selectedLabel}</span>
      )}
    </button>
  );
}

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
  const me = players.find((p) => p.id === mySocketId);
  const amAlive = me?.alive ?? false;

  const hasNightAction = amAlive && (myRole === "mafia" || myRole === "doctor" || myRole === "detective");

  const mafiaTargets = players.filter((p) => p.alive && p.id !== mySocketId && !mafiaIds.includes(p.id));
  const doctorTargets = players.filter((p) => p.alive);
  const detectiveTargets = players.filter((p) => p.alive && p.id !== mySocketId);

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
              <p className="text-xs font-medium" style={{
                color: myRole === "mafia" ? "#ef4444" :
                       myRole === "doctor" ? "#34d399" :
                       myRole === "detective" ? "#f59e0b" : "#6b7280"
              }}>
                {myRole === "mafia" && amAlive && "Choose your target"}
                {myRole === "doctor" && amAlive && "Choose someone to protect"}
                {myRole === "detective" && amAlive && "Choose someone to investigate"}
                {(!amAlive || myRole === "civilian") && "The town sleeps…"}
              </p>
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

        {/* ── Mafia targeting ── */}
        {myRole === "mafia" && amAlive && (
          <>
            <div className="flex flex-col gap-2 mb-6">
              {mafiaTargets.length === 0 ? (
                <p className="text-center text-gray-600 text-sm py-4">No valid targets.</p>
              ) : (
                mafiaTargets.map((player) => (
                  <TargetRow
                    key={player.id}
                    player={player}
                    isSelected={myNightVote === player.id}
                    accentClass="bg-red-950/60 border-red-700 shadow-[0_0_16px_rgba(185,28,28,0.2)]"
                    selectedAccentClass="text-red-400"
                    avatarClass="bg-red-700 text-white"
                    selectedLabel="TARGET ✓"
                    onClick={() => onNightVote(player.id)}
                  />
                ))
              )}
            </div>
            <p className="text-center text-gray-700 text-xs">
              {nightVoteStatus.voted} of {nightVoteStatus.total} Mafia{" "}
              {nightVoteStatus.voted === 1 ? "has" : "have"} voted
            </p>
          </>
        )}

        {/* ── Doctor protect ── */}
        {myRole === "doctor" && amAlive && (
          <>
            <div className="bg-emerald-950/30 border border-emerald-900/40 rounded-xl px-4 py-3 mb-5">
              <p className="text-emerald-400/80 text-xs leading-relaxed text-center">
                Choose one person to protect tonight. If the Mafia targets them, they survive.
              </p>
            </div>
            <div className="flex flex-col gap-2 mb-4">
              {doctorTargets.map((player) => {
                const isMe = player.id === mySocketId;
                return (
                  <TargetRow
                    key={player.id}
                    player={{ ...player, name: isMe ? `${player.name} (you)` : player.name }}
                    isSelected={myDoctorVote === player.id}
                    accentClass="bg-emerald-950/60 border-emerald-700 shadow-[0_0_16px_rgba(16,185,129,0.15)]"
                    selectedAccentClass="text-emerald-400"
                    avatarClass="bg-emerald-700 text-white"
                    selectedLabel="PROTECT ✓"
                    onClick={() => onDoctorProtect(player.id)}
                  />
                );
              })}
            </div>
            {myDoctorVote && (
              <p className="text-center text-emerald-600 text-xs">
                Protection chosen — you can change it before the timer ends.
              </p>
            )}
          </>
        )}

        {/* ── Detective investigate ── */}
        {myRole === "detective" && amAlive && (
          <>
            <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl px-4 py-3 mb-5">
              <p className="text-amber-400/70 text-xs leading-relaxed text-center">
                Investigate one player tonight. At dawn, you'll learn if they're Mafia.
              </p>
            </div>
            <div className="flex flex-col gap-2 mb-4">
              {detectiveTargets.map((player) => (
                <TargetRow
                  key={player.id}
                  player={player}
                  isSelected={myDetectiveVote === player.id}
                  accentClass="bg-amber-950/50 border-amber-600/60 shadow-[0_0_16px_rgba(180,83,9,0.15)]"
                  selectedAccentClass="text-amber-400"
                  avatarClass="bg-amber-600 text-white"
                  selectedLabel="INVESTIGATE ✓"
                  onClick={() => onDetectiveInvestigate(player.id)}
                />
              ))}
            </div>
            {myDetectiveVote && (
              <p className="text-center text-amber-700 text-xs">
                Target chosen — you can change it before the timer ends.
              </p>
            )}
          </>
        )}

        {/* ── Town sleeps ── */}
        {!hasNightAction && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
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

        {/* Player chip strip */}
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
                    : myRole === "mafia" && mafiaIds.includes(p.id)
                    ? "border-red-900/50 text-red-600 bg-red-950/20"
                    : "border-gray-800 text-gray-500"
                }`}
              >
                {p.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
