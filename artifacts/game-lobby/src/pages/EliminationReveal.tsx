import { useEffect } from "react";
import { playVoteOutImpact } from "@/lib/audio";

/** Votes per choice: a player's name, "skip", or null for "didn't vote". Who voted is secret. */
export type VoteTallyEntry = { target: string | null; votes: number };

type Props = {
  eliminatedName: string | null;
  skipped?: boolean;
  tally?: VoteTallyEntry[];
};

function VoteTally({ tally, eliminatedName }: { tally: VoteTallyEntry[]; eliminatedName: string | null }) {
  // Older servers sent one row per voter; ignore that shape rather than show names.
  const rows = tally.filter((row) => typeof row.votes === "number" && row.votes > 0);
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, row) => sum + row.votes, 0);
  return (
    <div className="mt-6 text-left">
      <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-gray-500">How the town voted</p>
      <ul className="flex flex-col gap-2 rounded-xl bg-black/30 px-3 py-3 ring-1 ring-white/10">
        {rows.map(({ target, votes }) => {
          const label = target === null ? "Didn't vote" : target === "skip" ? "Skipped" : target;
          const hit = target !== null && target === eliminatedName;
          const muted = target === null || target === "skip";
          return (
            <li key={target ?? "none"} className="text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className={`truncate ${hit ? "font-semibold text-red-300" : muted ? "italic text-gray-500" : "text-amber-100"}`}>
                  {label}
                </span>
                <span className="shrink-0 font-mono tabular-nums text-gray-400">
                  {votes} vote{votes === 1 ? "" : "s"}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                <div
                  className={`h-full rounded-full ${hit ? "bg-red-400/80" : muted ? "bg-gray-600" : "bar-gold"}`}
                  style={{ width: `${Math.round((votes / total) * 100)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] text-gray-600">Votes are secret. Only the totals are shown.</p>
    </div>
  );
}

export default function EliminationReveal({ eliminatedName, skipped, tally = [] }: Props) {
  // The impact lands as the voted-out name appears (this screen mounts with it).
  useEffect(() => {
    if (eliminatedName && !skipped) playVoteOutImpact();
  }, [eliminatedName, skipped]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="game-panel w-full max-w-sm px-6 py-8 text-center">

        {skipped ? (
          <>
            <h2 className="font-display text-2xl font-bold text-gray-200 mb-3">No decision</h2>
            <p className="text-gray-500 text-base leading-relaxed">
              The town couldn't agree. No one was eliminated today.
            </p>
          </>
        ) : eliminatedName ? (
          <>
            <p className="text-xs text-gray-500 uppercase tracking-widest font-medium mb-6">
              The town has spoken…
            </p>

            <div className="rounded-2xl border border-gray-700/80 bg-black/30 px-6 py-6">
              <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-xl font-bold mx-auto mb-4 text-white">
                {eliminatedName.charAt(0).toUpperCase()}
              </div>
              <p className="font-display text-white text-2xl font-bold mb-2">{eliminatedName}</p>
              <p className="text-gray-500 text-sm">was voted out by the town.</p>
            </div>
          </>
        ) : (
          <p className="text-gray-500">The vote concluded with no result.</p>
        )}

        <VoteTally tally={tally} eliminatedName={eliminatedName} />

        <p className="mt-8 text-gray-600 text-xs animate-pulse">Night falls soon…</p>
      </div>
    </div>
  );
}
