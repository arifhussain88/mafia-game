export default function CivilianIcon({ size = 72 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      aria-label="Civilian"
    >
      {/* Head */}
      <circle cx="40" cy="21" r="13" fill="#d1d5db" />
      {/* Ear left */}
      <circle cx="27" cy="21" r="5" fill="#d1d5db" />
      {/* Ear right */}
      <circle cx="53" cy="21" r="5" fill="#d1d5db" />
      {/* Hair/cap line (flat top suggestion) */}
      <rect x="27" y="8" width="26" height="7" rx="3" fill="#9ca3af" />
      {/* Neck */}
      <rect x="35" y="33" width="10" height="7" rx="2" fill="#d1d5db" />
      {/* Body/torso */}
      <rect x="22" y="40" width="36" height="26" rx="8" fill="#d1d5db" />
      {/* Left arm */}
      <rect x="8" y="42" width="14" height="10" rx="5" fill="#d1d5db" />
      {/* Right arm */}
      <rect x="58" y="42" width="14" height="10" rx="5" fill="#d1d5db" />
      {/* Shirt detail / pocket */}
      <rect x="34" y="46" width="12" height="8" rx="3" fill="#e5e7eb" fillOpacity="0.5" />
      {/* Legs */}
      <rect x="26" y="64" width="11" height="14" rx="5" fill="#9ca3af" />
      <rect x="43" y="64" width="11" height="14" rx="5" fill="#9ca3af" />
    </svg>
  );
}
