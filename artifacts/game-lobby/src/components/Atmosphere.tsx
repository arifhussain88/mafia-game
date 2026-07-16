import type { GamePhase } from "@/App";

type Props = {
  phase: GamePhase;
};

export default function Atmosphere({ phase }: Props) {
  const isNightPhase =
    phase === "night-mafia" ||
    phase === "night-doctor" ||
    phase === "night-detective" ||
    phase === "night-summary";

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[-1]">
      {/* Layer 1: Base Texture (Aged Stone/Brick) */}
      <div className="absolute inset-0 bg-[#1c1c1f]">
        <svg
          className="absolute inset-0 w-full h-full opacity-40 mix-blend-overlay"
          xmlns="http://www.w3.org/2000/svg"
        >
          <filter id="stoneTexture">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.04"
              numOctaves="3"
              result="noise"
            />
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.3 0"
              in="noise"
            />
          </filter>
          <rect width="100%" height="100%" filter="url(#stoneTexture)" />
        </svg>
      </div>

      {/* Layer 2: Phase Overlay */}
      <div
        className="absolute inset-0 transition-colors"
        style={{
          transitionDuration: "1500ms",
          backgroundColor: isNightPhase
            ? "rgba(15, 10, 45, 0.55)" /* Deep blue-purple */
            : "rgba(120, 60, 10, 0.35)", /* Warm amber-sepia */
        }}
      />

      {/* Layer 3: Fog Wisps */}
      <div className="absolute inset-0 mix-blend-screen opacity-50">
        <div className="fog-layer fog-1" />
        <div className="fog-layer fog-2" />
        <div className="fog-layer fog-3" />
      </div>
    </div>
  );
}
