import { useState, useEffect } from "react";
import type { Player, Role } from "@/App";
import PlayerCircle from "@/components/PlayerCircle";
import { useCircleSize } from "@/hooks/useCircleSize";

type Props = {
  winner: "mafia" | "civilians";
  players: Player[];
  mySocketId: string;
  isHost: boolean;
  onPlayAgain: () => void;
};

const ROLE_ORDER: Role[] = ["mafia", "detective", "doctor", "civilian"];

const ROLE_META: Record<Role, { label: string; sectionTitle: string; accentCls: string; dotCls: string }> = {
  mafia:     { label: "Mafia",     sectionTitle: "Mafia",     accentCls: "text-red-400",    dotCls: "bg-red-600" },
  detective: { label: "Detective", sectionTitle: "Detective", accentCls: "text-amber-400",  dotCls: "bg-amber-600" },
  doctor:    { label: "Doctor",    sectionTitle: "Doctor",    accentCls: "text-emerald-400", dotCls: "bg-emerald-600" },
  civilian:  { label: "Civilian",  sectionTitle: "Civilians", accentCls: "text-gray-400",   dotCls: "bg-gray-500" },
};

export default function GameOver({ winner, players, mySocketId, isHost, onPlayAgain }: Props) {
  const [revealAll, setRevealAll] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [showRoles, setShowRoles] = useState(false);
  const circleSize = useCircleSize();

  useEffect(() => {
    const t1 = setTimeout(() => setRevealAll(true),  1200);
    const t2 = setTimeout(() => setShowResult(true), 2200);
    const t3 = setTimeout(() => setShowRoles(true),  2800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const mafiaWon = winner === "mafia";
  const mafiaIds = players.filter((p) => p.role === "mafia").map((p) => p.id);
  const myRole = players.find((p) => p.id === mySocketId)?.role ?? null;

  const byRole = (role: Role) => players.filter((p) => p.role === role);

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8" style={{ background: "#0a0a0b" }}>

      {/* Pre-reveal suspense label */}
      {!showResult && (
        <div className="w-full max-w-sm md:max-w-2xl text-center py-1 mb-2">
          <p className="text-gray-700 text-xs md:text-sm uppercase tracking-widest animate-pulse">Game Over — Revealing Roles…</p>
        </div>
      )}

      {/* Winner result banner */}
      {showResult && (
        <div
          className={`w-full max-w-sm md:max-w-md rounded-2xl border px-6 py-5 text-center transition-opacity duration-700 mb-4 ${
            mafiaWon
              ? "bg-red-950/30 border-red-900/50 shadow-[0_0_48px_rgba(127,29,29,0.15)]"
              : "bg-amber-950/20 border-amber-900/30 shadow-[0_0_48px_rgba(120,53,15,0.1)]"
          }`}
          style={{ opacity: showResult ? 1 : 0 }}
        >
          <div className="text-4xl mb-2">{mafiaWon ? "🔪" : "🏆"}</div>
          <h1 className={`text-3xl md:text-4xl font-bold mb-1 ${mafiaWon ? "text-red-400" : "text-amber-400"}`}>
            {mafiaWon ? "Mafia Wins" : "Town Wins"}
          </h1>
          <p className="text-gray-500 text-xs md:text-sm leading-relaxed">
            {mafiaWon
              ? "The Mafia seized control of the town."
              : "The civilians uncovered and eliminated all Mafia."}
          </p>
        </div>
      )}

      {/* Circle of players — all cards start face-down, flip simultaneously */}
      <PlayerCircle
        players={players}
        mySocketId={mySocketId}
        myRole={myRole}
        mafiaIds={mafiaIds}
        selectedId={null}
        actionMode="none"
        onSelect={() => {}}
        revealAll={revealAll}
        circleSize={circleSize}
      />

      {/* Role breakdown list */}
      <div
        className="w-full max-w-sm md:max-w-md mt-4"
        style={{
          transition: "opacity 0.7s ease",
          opacity: showRoles ? 1 : 0,
        }}
      >
        {ROLE_ORDER.map((role) => {
          const group = byRole(role);
          if (group.length === 0) return null;
          const meta = ROLE_META[role];
          return (
            <div key={role} className="mb-3">
              <p className={`text-[10px] md:text-xs uppercase tracking-widest font-semibold mb-1.5 px-1 ${meta.accentCls}`}>
                {meta.sectionTitle}
              </p>
              <div className="flex flex-col gap-1.5">
                {group.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/3 border border-white/5"
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dotCls} ${p.alive ? "" : "opacity-40"}`} />
                    <p
                      className={`text-sm md:text-base font-medium flex-1 min-w-0 truncate ${
                        p.alive ? "text-white" : "text-gray-600 line-through"
                      }`}
                    >
                      {p.name}
                      {p.id === mySocketId && (
                        <span className="text-gray-600 text-xs ml-1">(you)</span>
                      )}
                    </p>
                    {!p.alive && (
                      <span className="text-gray-700 text-xs md:text-sm">eliminated</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Play Again */}
      <div className="w-full max-w-xs mt-4 pb-4">
        {isHost ? (
          <button
            onClick={onPlayAgain}
            className="w-full min-h-[52px] rounded-xl bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-base md:text-lg font-semibold transition-colors"
          >
            Play Again
          </button>
        ) : (
          <div className="text-center py-2">
            <div className="inline-flex items-center gap-2 text-gray-600 text-sm md:text-base">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse inline-block" />
              Waiting for host to start a new game
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
