export default function DoctorIcon({ size = 72 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      aria-label="Doctor"
    >
      {/* Left earpiece */}
      <circle cx="24" cy="13" r="6" fill="#34d399" />
      {/* Right earpiece */}
      <circle cx="56" cy="13" r="6" fill="#34d399" />
      {/* Left ear tube arc */}
      <path
        d="M24 19 Q24 36 40 42"
        stroke="#34d399"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Right ear tube arc */}
      <path
        d="M56 19 Q56 36 40 42"
        stroke="#34d399"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Vertical tube */}
      <line
        x1="40"
        y1="42"
        x2="40"
        y2="63"
        stroke="#34d399"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Chest piece outer */}
      <circle cx="40" cy="70" r="11" fill="#34d399" />
      {/* Chest piece inner ring */}
      <circle cx="40" cy="70" r="6" fill="#065f46" />
      {/* Chest piece highlight dot */}
      <circle cx="40" cy="70" r="2.5" fill="#6ee7b7" />
    </svg>
  );
}
