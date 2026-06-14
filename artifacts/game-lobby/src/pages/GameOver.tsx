import type { Player, Role } from "@/App";

type Props = {
  winner: "mafia" | "civilians";
  players: Player[];
  mySocketId: string;
  isHost: boolean;
  onPlayAgain: () => void;
};

const ROLE_CONFIG: Record<Role, { label: string; emoji: string; sectionTitle: string; rowCls: string; avatarAliveCls: string; avatarDeadCls: string; iconCls: string }> = {
  mafia: {
    label: "Mafia",
    emoji: "🔪",
    sectionTitle: "Mafia",
    rowCls: "bg-red-950/25 border-red-900/40",
    avatarAliveCls: "bg-red-700 text-white",
    avatarDeadCls: "bg-red-950 text-red-800",
    iconCls: "text-red-500",
  },
  detective: {
    label: "Detective",
    emoji: "🔍",
    sectionTitle: "Detective",
    rowCls: "bg-amber-950/20 border-amber-900/30",
    avatarAliveCls: "bg-amber-600 text-white",
    avatarDeadCls: "bg-amber-950 text-amber-800",
    iconCls: "text-amber-500",
  },
  doctor: {
    label: "Doctor",
    emoji: "💊",
    sectionTitle: "Doctor",
    rowCls: "bg-emerald-950/20 border-emerald-900/30",
    avatarAliveCls: "bg-emerald-700 text-white",
    avatarDeadCls: "bg-emerald-950 text-emerald-800",
    iconCls: "text-emerald-500",
  },
  civilian: {
    label: "Civilian",
    emoji: "🏘️",
    sectionTitle: "Civilians",
    rowCls: "bg-gray-900/60 border-gray-800",
    avatarAliveCls: "bg-gray-600 text-white",
    avatarDeadCls: "bg-gray-800 text-gray-600",
    iconCls: "text-gray-500",
  },
};

const ROLE_ORDER: Role[] = ["mafia", "detective", "doctor", "civilian"];

function RoleSection({ role, players, mySocketId }: { role: Role; players: Player[]; mySocketId: string }) {
  if (players.length === 0) return null;
  const cfg = ROLE_CONFIG[role];

  return (
    <div className="mb-4">
      <p className={`text-xs uppercase tracking-widest font-semibold mb-2 px-1 ${cfg.iconCls}`}>
        {cfg.sectionTitle}
      </p>
      <div className="flex flex-col gap-2">
        {players.map((player) => {
          const isMe = player.id === mySocketId;
          return (
            <div key={player.id} className={`flex items-center gap-3 min-h-[52px] px-4 rounded-xl border ${cfg.rowCls}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${player.alive ? cfg.avatarAliveCls : cfg.avatarDeadCls}`}>
                {player.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${player.alive ? "text-white" : "text-gray-600 line-through"}`}>
                  {player.name}
                  {isMe && <span className="text-gray-600 text-xs ml-1">(you)</span>}
                </p>
                {!player.alive && <p className="text-xs text-gray-700">eliminated</p>}
              </div>
              <span className={`text-base ${cfg.iconCls}`}>{cfg.emoji}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function GameOver({ winner, players, mySocketId, isHost, onPlayAgain }: Props) {
  const mafiaWon = winner === "mafia";

  const byRole = (role: Role) => players.filter((p) => p.role === role);

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-10" style={{ background: "#0a0a0b" }}>
      <div className="w-full max-w-sm">

        {/* Result banner */}
        <div
          className={`rounded-2xl border px-6 py-8 text-center mb-6 ${
            mafiaWon
              ? "bg-red-950/30 border-red-900/50 shadow-[0_0_48px_rgba(127,29,29,0.15)]"
              : "bg-amber-950/20 border-amber-900/30 shadow-[0_0_48px_rgba(120,53,15,0.1)]"
          }`}
        >
          <div className="text-5xl mb-3">{mafiaWon ? "🔪" : "🏆"}</div>
          <h1 className={`text-4xl font-bold mb-2 ${mafiaWon ? "text-red-400" : "text-amber-400"}`}>
            {mafiaWon ? "Mafia Wins" : "Town Wins"}
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            {mafiaWon
              ? "The Mafia seized control of the town."
              : "The civilians uncovered and eliminated all Mafia."}
          </p>
        </div>

        {/* Role sections in order */}
        {ROLE_ORDER.map((role) => (
          <RoleSection key={role} role={role} players={byRole(role)} mySocketId={mySocketId} />
        ))}

        {/* Play Again */}
        <div className="mt-2">
          {isHost ? (
            <button
              onClick={onPlayAgain}
              className="w-full min-h-[56px] rounded-xl bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-lg font-semibold transition-colors"
            >
              Play Again
            </button>
          ) : (
            <div className="text-center py-2">
              <div className="inline-flex items-center gap-2 text-gray-600 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse inline-block" />
                Waiting for host to start a new game
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
