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
      <circle cx="40" cy="21" r="13" fill="#bdb8ad" />
      {/* Ear left */}
      <circle cx="27" cy="21" r="5" fill="#bdb8ad" />
      {/* Ear right */}
      <circle cx="53" cy="21" r="5" fill="#bdb8ad" />
      {/* Hair/cap line (flat top suggestion) */}
      <rect x="27" y="8" width="26" height="7" rx="3" fill="#9c968a" />
      {/* Neck */}
      <rect x="35" y="33" width="10" height="7" rx="2" fill="#bdb8ad" />
      {/* Body/torso */}
      <rect x="22" y="40" width="36" height="26" rx="8" fill="#bdb8ad" />
      {/* Left arm */}
      <rect x="8" y="42" width="14" height="10" rx="5" fill="#bdb8ad" />
      {/* Right arm */}
      <rect x="58" y="42" width="14" height="10" rx="5" fill="#bdb8ad" />
      {/* Shirt detail / pocket */}
      <rect x="34" y="46" width="12" height="8" rx="3" fill="#e5e7eb" fillOpacity="0.5" />
      {/* Legs */}
      <rect x="26" y="64" width="11" height="14" rx="5" fill="#9c968a" />
      <rect x="43" y="64" width="11" height="14" rx="5" fill="#9c968a" />
    </svg>
  );
}
