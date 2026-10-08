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
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[-1] bg-[#0F172A]">

      {/* Mobile: full-cover background image */}
      <div
        className="absolute inset-0 sm:hidden"
        style={{
          backgroundImage: `url(/background-mobile.jpg)`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          opacity: 0.55,
          filter: "grayscale(10%) brightness(65%)",
        }}
      />

      {/* Desktop/laptop: centered art, raised visibility */}
      <div className="hidden sm:flex absolute inset-0 items-center justify-center pointer-events-none">
        <div
          className="max-w-[1100px] max-h-[700px] w-full h-full"
          style={{
            backgroundImage: `url(/background-mobile.jpg)`,
            backgroundSize: "contain",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            opacity: 0.38,
            filter: "grayscale(10%) brightness(70%)",
          }}
        />
      </div>

      {/* Dark gradient scrim for readable panels on both viewports */}
      <div
        className="absolute inset-0"
        style={{
          background: isNightPhase
            ? "linear-gradient(180deg, rgba(8,10,16,0.55) 0%, rgba(8,10,16,0.78) 45%, rgba(8,10,16,0.92) 100%)"
            : "linear-gradient(180deg, rgba(8,10,16,0.45) 0%, rgba(8,10,16,0.72) 50%, rgba(8,10,16,0.9) 100%)",
        }}
      />

      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
        style={{ mixBlendMode: "screen", opacity: 0.4, pointerEvents: "none" }}
      >
        <defs>
          <filter id="blur"><feGaussianBlur stdDeviation="36" /></filter>
        </defs>

        <rect width="100%" height="100%" fill="transparent" />

        <g filter="url(#blur)" opacity="0.55">
          <circle cx="200" cy="180" r="120" fill={isNightPhase ? "#5b0b3f" : "#2b0c05"}>
            <animate attributeName="cx" dur="12s" values="160;220;200;160" repeatCount="indefinite" />
            <animate attributeName="cy" dur="18s" values="150;200;170;150" repeatCount="indefinite" />
            <animate attributeName="r" dur="8s" values="110;125;120;110" repeatCount="indefinite" />
          </circle>
          <circle cx="600" cy="120" r="160" fill={isNightPhase ? "#1b2a4b" : "#2a0f06"}>
            <animate attributeName="cx" dur="14s" values="620;560;600;620" repeatCount="indefinite" />
            <animate attributeName="cy" dur="20s" values="120;170;140;120" repeatCount="indefinite" />
            <animate attributeName="r" dur="9s" values="150;165;160;150" repeatCount="indefinite" />
          </circle>
          <circle cx="420" cy="420" r="140" fill={isNightPhase ? "#4b1620" : "#23110a"}>
            <animate attributeName="cx" dur="16s" values="380;460;420;380" repeatCount="indefinite" />
            <animate attributeName="cy" dur="14s" values="420;380;440;420" repeatCount="indefinite" />
            <animate attributeName="r" dur="10s" values="130;145;140;130" repeatCount="indefinite" />
          </circle>
        </g>

        <g opacity="0.12" fill="#fff">
          {Array.from({ length: 28 }).map((_, i) => {
            const x = 30 + ((i * 73) % 760);
            const y = 30 + ((i * 47) % 560);
            return (
              // eslint-disable-next-line react/no-array-index-key
              <circle key={i} cx={x} cy={y} r={(i % 3) + 0.6}>
                <animate attributeName="opacity" dur={`${6 + (i % 5)}s`} values="0.05;0.5;0.05" repeatCount="indefinite" />
              </circle>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
