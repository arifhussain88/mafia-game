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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ background: "#0a0a0b" }}>
      <p className="text-gray-600 text-sm mb-10 tracking-widest uppercase font-medium">Your role</p>

      <div style={{ perspective: "900px" }} className="w-64 h-80">
        <div
          style={{
            transformStyle: "preserve-3d",
            transition: "transform 0.8s cubic-bezier(0.4,0,0.2,1)",
            transform: flipped ? "rotateY(0deg)" : "rotateY(180deg)",
            position: "relative",
            width: "100%",
            height: "100%",
          }}
        >
          {/* Front — role card */}
          <div
            style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
            className={`absolute inset-0 rounded-2xl flex flex-col items-center justify-center p-6 border ${
              isMafia
                ? "bg-red-950 border-red-900 shadow-[0_0_48px_rgba(185,28,28,0.25)]"
                : "bg-gray-900 border-gray-700 shadow-[0_0_32px_rgba(0,0,0,0.5)]"
            }`}
          >
            <div className="text-5xl mb-5">{isMafia ? "🔪" : "🏘️"}</div>
            <div className={`text-3xl font-bold tracking-wider mb-3 ${isMafia ? "text-red-400" : "text-amber-400"}`}>
              {isMafia ? "MAFIA" : "CIVILIAN"}
            </div>
            <p className="text-center text-sm leading-relaxed text-gray-400">
              {isMafia
                ? "Eliminate the civilians without being caught."
                : "Find and vote out the Mafia to save the town."}
            </p>
          </div>

          {/* Back */}
          <div
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
            className="absolute inset-0 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center"
          >
            <div className="text-6xl opacity-20 select-none">?</div>
          </div>
        </div>
      </div>

      {flipped && (
        <div className="mt-8 w-full max-w-xs">
          {isMafia && teammates.length > 0 && (
            <div className="bg-red-950/50 border border-red-900/50 rounded-xl px-4 py-3 text-center">
              <p className="text-red-500 text-xs font-semibold uppercase tracking-widest mb-1">
                {teammates.length === 1 ? "Your partner" : "Your partners"}
              </p>
              <p className="text-white font-semibold">{teammates.join(", ")}</p>
            </div>
          )}
          {isMafia && teammates.length === 0 && (
            <p className="text-center text-red-500/70 text-sm">You are the only Mafia member.</p>
          )}
          {!isMafia && (
            <p className="text-center text-gray-600 text-sm">Trust no one. The Mafia is among you.</p>
          )}
        </div>
      )}

      <p className="mt-10 text-gray-700 text-xs animate-pulse">Night begins soon…</p>
    </div>
  );
}
