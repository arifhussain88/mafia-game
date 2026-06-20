type Props = {
  phase: "night-result" | "day-result";
  eliminatedName: string | null;
  skipped?: boolean;
};

export default function EliminationReveal({ phase, eliminatedName, skipped }: Props) {
  const isNight = phase === "night-result";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: isNight ? "#060710" : "#120e08" }}
    >
      <div className="w-full max-w-sm text-center">

        {skipped ? (
          <>
            <div className="text-5xl mb-6 opacity-70">🗳️</div>
            <h2 className="text-2xl font-bold text-gray-200 mb-3">No decision</h2>
            <p className="text-gray-500 text-base leading-relaxed">
              The town couldn't reach a majority. No one was eliminated today.
            </p>
          </>
        ) : eliminatedName ? (
          <>
            <p className="text-xs text-gray-600 uppercase tracking-widest font-medium mb-8">
              {isNight ? "The town wakes to find…" : "The town has spoken…"}
            </p>

            <div className="rounded-2xl border border-gray-800 bg-gray-900 px-6 py-7 mb-6 shadow-[0_0_32px_rgba(0,0,0,0.5)]">
              <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-xl font-bold mx-auto mb-4 text-white">
                {eliminatedName.charAt(0).toUpperCase()}
              </div>
              <p className="text-white text-2xl font-bold mb-3">{eliminatedName}</p>
              <p className="text-gray-500 text-sm">
                {isNight ? "was found dead this morning." : "was voted out by the town."}
              </p>
            </div>

            <p className="text-gray-600 text-xs leading-relaxed">
              {isNight ? "The game continues at dawn." : "The game continues through the night."}
            </p>
          </>
        ) : (
          <>
            <div className="text-5xl mb-6 opacity-40">🌙</div>
            <p className="text-gray-500">The night passes quietly…</p>
          </>
        )}

        <p className="mt-12 text-gray-700 text-xs animate-pulse">Next phase starting…</p>
      </div>
    </div>
  );
}
