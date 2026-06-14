import { useState, useEffect } from "react";
import type { Role } from "@/App";

type Props = {
  role: Role;
  mafiaNames: string[];
  myName: string;
};

export default function RoleReveal({ role, mafiaNames, myName }: Props) {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setFlipped(true), 1200);
    return () => clearTimeout(t);
  }, []);

  const isMafia = role === "mafia";
  const teammates = mafiaNames.filter((n) => n !== myName);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-gray-950">
      <p className="text-gray-400 text-base mb-8 tracking-wide">Your role has been assigned…</p>

      <div style={{ perspective: "900px" }} className="w-64 h-80">
        <div
          style={{
            transformStyle: "preserve-3d",
            transition: "transform 0.75s cubic-bezier(0.4,0,0.2,1)",
            transform: flipped ? "rotateY(0deg)" : "rotateY(180deg)",
            position: "relative",
            width: "100%",
            height: "100%",
          }}
        >
          <div
            style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
            className={`absolute inset-0 rounded-2xl flex flex-col items-center justify-center p-6 border ${
              isMafia
                ? "bg-red-950 border-red-800 shadow-[0_0_40px_rgba(220,38,38,0.3)]"
                : "bg-blue-950 border-blue-800 shadow-[0_0_40px_rgba(37,99,235,0.3)]"
            }`}
          >
            <div className="text-5xl mb-4">{isMafia ? "🔪" : "🏘️"}</div>
            <div
              className={`text-3xl font-bold tracking-wider mb-3 ${
                isMafia ? "text-red-300" : "text-blue-300"
              }`}
            >
              {isMafia ? "MAFIA" : "CIVILIAN"}
            </div>
            <p className="text-center text-sm leading-relaxed text-gray-300">
              {isMafia
                ? "Eliminate the civilians without being caught."
                : "Find and vote out the Mafia to save the town."}
            </p>
          </div>

          <div
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
            className="absolute inset-0 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center"
          >
            <div className="text-6xl opacity-30">?</div>
          </div>
        </div>
      </div>

      {flipped && (
        <div className="mt-8 w-full max-w-xs animate-[fadeIn_0.4s_ease]">
          {isMafia && teammates.length > 0 && (
            <div className="bg-red-950/60 border border-red-800/50 rounded-xl px-4 py-3 text-center">
              <p className="text-red-400 text-xs font-semibold uppercase tracking-widest mb-1">
                Your {teammates.length === 1 ? "partner" : "partners"}
              </p>
              <p className="text-white font-medium">{teammates.join(", ")}</p>
            </div>
          )}
          {isMafia && teammates.length === 0 && (
            <p className="text-center text-red-400 text-sm">You are the only Mafia member.</p>
          )}
          {!isMafia && (
            <p className="text-center text-gray-500 text-sm">
              Stay alert — the Mafia is among you.
            </p>
          )}
        </div>
      )}

      <p className="mt-10 text-gray-600 text-xs animate-pulse">Night begins soon…</p>
    </div>
  );
}
