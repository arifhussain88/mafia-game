export default function DetectiveIcon({ size = 72 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      aria-label="Detective"
    >
      {/* Lens glass fill */}
      <circle cx="33" cy="33" r="21" fill="#fbbf24" fillOpacity="0.12" />
      {/* Lens ring */}
      <circle cx="33" cy="33" r="21" stroke="#fbbf24" strokeWidth="6" fill="none" />
      {/* Handle */}
      <line
        x1="49"
        y1="49"
        x2="71"
        y2="71"
        stroke="#fbbf24"
        strokeWidth="9"
        strokeLinecap="round"
      />
      {/* Crosshair horizontal */}
      <line
        x1="18"
        y1="33"
        x2="48"
        y2="33"
        stroke="#fbbf24"
        strokeWidth="2"
        strokeOpacity="0.4"
        strokeDasharray="4 3"
      />
      {/* Crosshair vertical */}
      <line
        x1="33"
        y1="18"
        x2="33"
        y2="48"
        stroke="#fbbf24"
        strokeWidth="2"
        strokeOpacity="0.4"
        strokeDasharray="4 3"
      />
      {/* Center dot */}
      <circle cx="33" cy="33" r="3" fill="#fbbf24" fillOpacity="0.7" />
    </svg>
  );
}
