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
      <circle cx="33" cy="33" r="21" fill="#d3a947" fillOpacity="0.12" />
      {/* Lens ring */}
      <circle cx="33" cy="33" r="21" stroke="#d3a947" strokeWidth="6" fill="none" />
      {/* Handle */}
      <line
        x1="49"
        y1="49"
        x2="71"
        y2="71"
        stroke="#d3a947"
        strokeWidth="9"
        strokeLinecap="round"
      />
      {/* Crosshair horizontal */}
      <line
        x1="18"
        y1="33"
        x2="48"
        y2="33"
        stroke="#d3a947"
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
        stroke="#d3a947"
        strokeWidth="2"
        strokeOpacity="0.4"
        strokeDasharray="4 3"
      />
      {/* Center dot */}
      <circle cx="33" cy="33" r="3" fill="#d3a947" fillOpacity="0.7" />
    </svg>
  );
}
