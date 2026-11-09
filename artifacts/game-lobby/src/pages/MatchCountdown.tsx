import { useEffect, useRef, useState } from "react";
import type { Player } from "@/App";
import { playCountdownTick } from "@/lib/audio";

type Props = {
  players: Player[];
  timerEndsAt: number | null;
};

export default function MatchCountdown({ players, timerEndsAt }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(5);
  const lastTickRef = useRef<number | null>(null);

  useEffect(() => {
    if (!timerEndsAt) return;

    function tick() {
      const left = Math.max(0, Math.ceil((timerEndsAt! - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left > 0 && lastTickRef.current !== left) {
        lastTickRef.current = left;
        playCountdownTick();
      }
    }

    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [timerEndsAt]);

  const display = Math.max(1, secondsLeft);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <div className="game-panel w-full max-w-sm md:max-w-md px-6 py-8 text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-amber-500/80 mb-4 font-semibold">
          Match starting
        </p>
        <div
          key={display}
          className="font-display text-7xl md:text-8xl font-bold text-white tabular-nums mb-6"
          style={{ textShadow: "0 0 40px rgba(217,119,6,0.35)" }}
        >
          {display}
        </div>
        <p className="text-gray-400 text-sm mb-6">Get ready — roles appear next</p>

        <div className="flex flex-col gap-2 text-left">
          <p className="text-[10px] uppercase tracking-widest text-gray-600 font-semibold mb-1">
            Players · {players.length}
          </p>
          {players.map((player) => (
            <div
              key={player.id}
              className="flex items-center gap-3 min-h-[44px] px-3 rounded-xl bg-black/30 border border-white/5"
            >
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-white">
                {player.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-white text-sm font-medium truncate">{player.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
