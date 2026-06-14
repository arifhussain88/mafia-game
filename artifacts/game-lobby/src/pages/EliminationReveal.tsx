import type { Role } from "@/App";

type Props = {
  phase: "night-result" | "day-result";
  eliminatedName: string | null;
  eliminatedRole: Role | null;
  skipped?: boolean;
};

export default function EliminationReveal({ phase, eliminatedName, eliminatedRole, skipped }: Props) {
  const isNight = phase === "night-result";
  const isMafia = eliminatedRole === "mafia";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: isNight ? "#060812" : "#1a1208" }}
    >
      <div className="w-full max-w-sm text-center">
        {skipped ? (
          <>
            <div className="text-5xl mb-5">🗳️</div>
            <h2 className="text-2xl font-bold text-gray-100 mb-3">No decision</h2>
            <p className="text-gray-400 text-base">The town couldn't reach a majority. No one was eliminated.</p>
          </>
        ) : eliminatedName ? (
          <>
            <div className="text-5xl mb-5">{isNight ? "🌙" : "☀️"}</div>
            <p className="text-gray-400 text-sm uppercase tracking-widest mb-2">
              {isNight ? "The town wakes to find…" : "The town has spoken…"}
            </p>
            <div
              className={`rounded-2xl border px-6 py-6 mb-4 ${
                isMafia
                  ? "bg-red-950/50 border-red-800/60"
                  : "bg-gray-900 border-gray-700"
              }`}
            >
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3 ${
                  isMafia ? "bg-red-700 text-white" : "bg-gray-700 text-white"
                }`}
              >
                {eliminatedName.charAt(0).toUpperCase()}
              </div>
              <p className="text-white text-2xl font-bold mb-1">{eliminatedName}</p>
              <p className={`text-sm font-semibold uppercase tracking-widest ${isMafia ? "text-red-400" : "text-blue-400"}`}>
                was {isMafia ? "Mafia 🔪" : "a Civilian 🏘️"}
              </p>
            </div>
            <p className="text-gray-500 text-sm">
              {isMafia ? "The town eliminated a Mafia member!" : "The Mafia claimed another victim."}
            </p>
          </>
        ) : (
          <>
            <div className="text-5xl mb-5">🌙</div>
            <p className="text-gray-400">The night passes quietly…</p>
          </>
        )}
        <p className="mt-10 text-gray-600 text-xs animate-pulse">Next phase starting soon…</p>
      </div>
    </div>
  );
}
