export default function MafiaIcon({ size = 72 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      aria-label="Mafia"
    >
      {/* Hat crown */}
      <rect x="18" y="7" width="44" height="27" rx="11" fill="#fca5a5" />
      {/* Band at base of crown */}
      <rect x="18" y="26" width="44" height="9" rx="2" fill="#9b1c1c" />
      {/* Hat brim */}
      <rect x="5" y="31" width="70" height="12" rx="5" fill="#fca5a5" />
      {/* Shadow below brim — mystery face */}
      <ellipse cx="40" cy="48" rx="15" ry="4" fill="#0c0204" />
      {/* Coat body */}
      <path d="M9 55 L71 55 L77 80 L3 80 Z" fill="#374151" />
      {/* Left lapel */}
      <path d="M28 55 L14 76 L30 76 Z" fill="#4b5563" />
      {/* Right lapel */}
      <path d="M52 55 L66 76 L50 76 Z" fill="#4b5563" />
      {/* Center button seam */}
      <line x1="40" y1="58" x2="40" y2="78" stroke="#1f2937" strokeWidth="2" strokeDasharray="3 3" />
      {/* Collar triangle left */}
      <path d="M29 55 L40 46 L40 55 Z" fill="#4b5563" />
      {/* Collar triangle right */}
      <path d="M51 55 L40 46 L40 55 Z" fill="#6b7280" />
    </svg>
  );
}
