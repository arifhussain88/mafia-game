export type VoteTallyEntry = { voter: string; target: string | null };

type Props = {
  eliminatedName: string | null;
  skipped?: boolean;
  tally?: VoteTallyEntry[];
};

function VoteTally({ tally, eliminatedName }: { tally: VoteTallyEntry[]; eliminatedName: string | null }) {
  if (tally.length === 0) return null;
  return (
    <div className="mt-6 text-left">
      <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-gray-500">How the town voted</p>
      <ul className="flex flex-col divide-y divide-white/5 rounded-xl bg-black/30 ring-1 ring-white/10">
        {tally.map(({ voter, target }) => {
          const label = target === null ? "didn't vote" : target === "skip" ? "skipped" : target;
          const hit = target !== null && target === eliminatedName;
          return (
            <li key={voter} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="truncate text-gray-200">{voter}</span>
              <span
                className={`truncate ${
                  hit ? "text-red-300 font-semibold" : target === null || target === "skip" ? "text-gray-500 italic" : "text-amber-200"
                }`}
              >
                {target !== null && target !== "skip" && <span className="text-gray-600">→ </span>}
                {label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function EliminationReveal({ eliminatedName, skipped, tally = [] }: Props) {
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
