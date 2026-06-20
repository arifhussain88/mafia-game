export default function CardBack({ width, height }: { width: number; height: number }) {
  return (
    <svg viewBox="0 0 120 168" width={width} height={height} aria-label="Card back">
      {/* Background */}
      <rect width="120" height="168" rx="10" fill="#0c1117" />

      {/* Double border */}
      <rect x="3" y="3" width="114" height="162" rx="8" fill="none" stroke="#92400e" strokeWidth="1.5" />
      <rect x="6" y="6" width="108" height="156" rx="6" fill="none" stroke="#d97706" strokeWidth="0.8" strokeOpacity="0.5" />

      {/* Corner diamond ornaments */}
      <polygon points="12,10 16,6 20,10 16,14" fill="#b45309" />
      <polygon points="100,10 104,6 108,10 104,14" fill="#b45309" />
      <polygon points="12,158 16,154 20,158 16,162" fill="#b45309" />
      <polygon points="100,158 104,154 108,158 104,162" fill="#b45309" />

      {/* Outer diamond outline */}
      <polygon points="60,36 96,84 60,132 24,84" fill="none" stroke="#92400e" strokeWidth="1.5" />
      {/* Inner diamond outline */}
      <polygon points="60,48 84,84 60,120 36,84" fill="none" stroke="#b45309" strokeWidth="0.8" strokeOpacity="0.5" />

      {/* All-seeing eye (almond shape) */}
      <path d="M28,84 Q60,60 92,84 Q60,108 28,84 Z" fill="none" stroke="#b45309" strokeWidth="1.5" />

      {/* Iris */}
      <circle cx="60" cy="84" r="14" fill="#0c1117" stroke="#d97706" strokeWidth="1.5" />
      {/* Pupil rings */}
      <circle cx="60" cy="84" r="9" fill="#92400e" fillOpacity="0.65" />
      <circle cx="60" cy="84" r="5" fill="#f59e0b" fillOpacity="0.8" />
      {/* Highlight */}
      <circle cx="64" cy="80" r="2.5" fill="#fef3c7" fillOpacity="0.8" />

      {/* Cardinal rays from eye */}
      <line x1="60" y1="66" x2="60" y2="58" stroke="#92400e" strokeWidth="1" strokeOpacity="0.5" />
      <line x1="60" y1="102" x2="60" y2="110" stroke="#92400e" strokeWidth="1" strokeOpacity="0.5" />
      <line x1="44" y1="84" x2="36" y2="84" stroke="#92400e" strokeWidth="1" strokeOpacity="0.5" />
      <line x1="76" y1="84" x2="84" y2="84" stroke="#92400e" strokeWidth="1" strokeOpacity="0.5" />
      <line x1="50" y1="74" x2="44" y2="68" stroke="#92400e" strokeWidth="1" strokeOpacity="0.3" />
      <line x1="70" y1="74" x2="76" y2="68" stroke="#92400e" strokeWidth="1" strokeOpacity="0.3" />
      <line x1="50" y1="94" x2="44" y2="100" stroke="#92400e" strokeWidth="1" strokeOpacity="0.3" />
      <line x1="70" y1="94" x2="76" y2="100" stroke="#92400e" strokeWidth="1" strokeOpacity="0.3" />
    </svg>
  );
}
