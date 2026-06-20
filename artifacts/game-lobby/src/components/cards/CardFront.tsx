import type { Role } from "@/App";

type D = { width: number; height: number };

function MafiaFront({ width, height }: D) {
  return (
    <svg viewBox="0 0 120 168" width={width} height={height} aria-label="Mafia">
      <rect width="120" height="168" rx="10" fill="#12040a" />
      <rect x="2" y="2" width="116" height="164" rx="9" fill="none" stroke="#7f1d1d" strokeWidth="1.5" />

      {/* Hat crown */}
      <path d="M38,50 L38,22 Q38,10 60,10 Q82,10 82,22 L82,50 Z" fill="#1e2235" stroke="#0d0f17" strokeWidth="2.5" />
      {/* Crown dent */}
      <path d="M52,23 Q60,17 68,23" fill="none" stroke="#0d0f17" strokeWidth="1.5" />
      {/* Band */}
      <rect x="38" y="42" width="44" height="9" rx="1" fill="#3d0808" />
      {/* Brim */}
      <rect x="16" y="48" width="88" height="13" rx="7" fill="#1e2235" stroke="#0d0f17" strokeWidth="2.5" />
      {/* Brim highlight */}
      <path d="M20,52 Q60,48 100,52" fill="none" stroke="#2d3357" strokeWidth="1" strokeOpacity="0.5" />

      {/* Face shadow */}
      <ellipse cx="60" cy="70" rx="23" ry="14" fill="#07010b" />

      {/* Eye glows */}
      <circle cx="51" cy="68" r="7" fill="#f59e0b" fillOpacity="0.14" />
      <circle cx="69" cy="68" r="7" fill="#f59e0b" fillOpacity="0.14" />
      {/* Eyes */}
      <circle cx="51" cy="68" r="4" fill="#f59e0b" />
      <circle cx="69" cy="68" r="4" fill="#f59e0b" />
      {/* Pupils */}
      <circle cx="51" cy="68" r="2" fill="#7c2d12" />
      <circle cx="69" cy="68" r="2" fill="#7c2d12" />
      {/* Highlights */}
      <circle cx="53" cy="66" r="1.2" fill="#fef3c7" />
      <circle cx="71" cy="66" r="1.2" fill="#fef3c7" />

      {/* Smirk */}
      <path d="M55,77 Q60,81 65,77" fill="none" stroke="#7f1d1d" strokeWidth="1.5" strokeLinecap="round" />

      {/* Coat body */}
      <path d="M22,84 L98,84 L106,133 L14,133 Z" fill="#10121c" stroke="#1e2235" strokeWidth="2" />
      {/* Collar left */}
      <path d="M44,84 L60,78 L60,84 Z" fill="#1a1f2e" stroke="#0d0f17" strokeWidth="1" />
      {/* Collar right */}
      <path d="M76,84 L60,78 L60,84 Z" fill="#141820" stroke="#0d0f17" strokeWidth="1" />
      {/* Left lapel */}
      <path d="M44,84 L28,110 L48,110 Z" fill="#141825" stroke="#1e2235" strokeWidth="1.5" />
      {/* Right lapel */}
      <path d="M76,84 L92,110 L72,110 Z" fill="#141825" stroke="#1e2235" strokeWidth="1.5" />
      {/* Center seam */}
      <line x1="60" y1="88" x2="60" y2="130" stroke="#1e2235" strokeWidth="1" strokeDasharray="3 4" />
      {/* Buttons */}
      <circle cx="60" cy="98" r="2.5" fill="#3d0808" />
      <circle cx="60" cy="110" r="2.5" fill="#3d0808" />
      <circle cx="60" cy="122" r="2.5" fill="#3d0808" />

      {/* Name bar */}
      <rect x="0" y="133" width="120" height="35" rx="0" fill="#0a0206" />
      <line x1="0" y1="133" x2="120" y2="133" stroke="#991b1b" strokeWidth="1.5" />
      <text x="60" y="155" textAnchor="middle" fontSize="15" fontWeight="800" fill="#ef4444" letterSpacing="4" fontFamily="'Courier New', monospace">MAFIA</text>
      <circle cx="10" cy="151" r="2.5" fill="#7f1d1d" />
      <circle cx="110" cy="151" r="2.5" fill="#7f1d1d" />
    </svg>
  );
}

function DoctorFront({ width, height }: D) {
  return (
    <svg viewBox="0 0 120 168" width={width} height={height} aria-label="Doctor">
      <rect width="120" height="168" rx="10" fill="#04100b" />
      <rect x="2" y="2" width="116" height="164" rx="9" fill="none" stroke="#065f46" strokeWidth="1.5" />

      {/* Hair */}
      <ellipse cx="60" cy="22" rx="22" ry="16" fill="#5d3b1c" />
      <path d="M44,18 Q52,13 60,15 Q68,13 76,18" fill="none" stroke="#7c5230" strokeWidth="1.5" strokeOpacity="0.5" />

      {/* Head */}
      <circle cx="60" cy="38" r="22" fill="#f5c5a3" stroke="#d4956a" strokeWidth="1.5" />

      {/* Cheeks */}
      <ellipse cx="44" cy="44" rx="7" ry="5" fill="#f87171" fillOpacity="0.35" />
      <ellipse cx="76" cy="44" rx="7" ry="5" fill="#f87171" fillOpacity="0.35" />

      {/* Eyes */}
      <ellipse cx="51" cy="34" rx="6" ry="7" fill="white" stroke="#222" strokeWidth="1.5" />
      <ellipse cx="69" cy="34" rx="6" ry="7" fill="white" stroke="#222" strokeWidth="1.5" />
      <circle cx="51" cy="35" r="4" fill="#2d5a1b" />
      <circle cx="69" cy="35" r="4" fill="#2d5a1b" />
      <circle cx="51" cy="35" r="2.5" fill="#111" />
      <circle cx="69" cy="35" r="2.5" fill="#111" />
      <circle cx="53" cy="33" r="1.5" fill="white" />
      <circle cx="71" cy="33" r="1.5" fill="white" />

      {/* Eyebrows (friendly, slightly raised) */}
      <path d="M44,27 Q51,23 57,26" fill="none" stroke="#5d3b1c" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M63,26 Q69,23 76,27" fill="none" stroke="#5d3b1c" strokeWidth="2.5" strokeLinecap="round" />

      {/* Nose */}
      <path d="M58,40 Q60,43 62,40" fill="none" stroke="#d4956a" strokeWidth="1.5" strokeLinecap="round" />

      {/* Smile */}
      <path d="M49,47 Q60,56 71,47" fill="none" stroke="#c17a50" strokeWidth="2" strokeLinecap="round" />

      {/* Neck */}
      <rect x="54" y="58" width="12" height="10" rx="3" fill="#f5c5a3" />

      {/* White coat */}
      <rect x="16" y="66" width="88" height="67" rx="4" fill="#eff0e8" stroke="#c8c9c2" strokeWidth="1.5" />
      {/* Shirt V-neck */}
      <path d="M46,66 L60,82 L74,66" fill="#dbeafe" stroke="#bfdbfe" strokeWidth="1" />
      {/* Lapel lines */}
      <line x1="46" y1="66" x2="32" y2="82" stroke="#c8c9c2" strokeWidth="1.5" />
      <line x1="74" y1="66" x2="88" y2="82" stroke="#c8c9c2" strokeWidth="1.5" />
      {/* Left pocket */}
      <rect x="23" y="79" width="18" height="13" rx="2" fill="none" stroke="#c8c9c2" strokeWidth="1" />
      {/* Medical cross */}
      <rect x="29" y="83" width="6" height="2" rx="1" fill="#ef4444" />
      <rect x="31" y="81" width="2" height="6" rx="1" fill="#ef4444" />
      {/* Buttons */}
      <circle cx="78" cy="81" r="2.5" fill="#c8c9c2" />
      <circle cx="78" cy="92" r="2.5" fill="#c8c9c2" />
      <circle cx="78" cy="103" r="2.5" fill="#c8c9c2" />

      {/* Stethoscope U-shape */}
      <path d="M44,67 Q37,74 41,90 Q41,104 60,108 Q79,104 79,90 Q83,74 76,67" fill="none" stroke="#374151" strokeWidth="3" strokeLinecap="round" />
      {/* Chest piece */}
      <circle cx="60" cy="110" r="8" fill="#374151" />
      <circle cx="60" cy="110" r="5" fill="#4b5563" />
      <circle cx="60" cy="110" r="2" fill="#6b7280" />

      {/* Name bar */}
      <rect x="0" y="133" width="120" height="35" fill="#030b07" />
      <line x1="0" y1="133" x2="120" y2="133" stroke="#059669" strokeWidth="1.5" />
      <text x="60" y="155" textAnchor="middle" fontSize="13" fontWeight="800" fill="#34d399" letterSpacing="3" fontFamily="'Courier New', monospace">DOCTOR</text>
      <circle cx="10" cy="151" r="2.5" fill="#065f46" />
      <circle cx="110" cy="151" r="2.5" fill="#065f46" />
    </svg>
  );
}

function DetectiveFront({ width, height }: D) {
  return (
    <svg viewBox="0 0 120 168" width={width} height={height} aria-label="Detective">
      <rect width="120" height="168" rx="10" fill="#0d0902" />
      <rect x="2" y="2" width="116" height="164" rx="9" fill="none" stroke="#78350f" strokeWidth="1.5" />

      {/* Hat crown (warm amber/tan) */}
      <path d="M36,46 L36,20 Q36,10 60,10 Q84,10 84,20 L84,46 Z" fill="#6b4c1e" stroke="#3d2b0a" strokeWidth="2.5" />
      {/* Crown dent */}
      <path d="M50,22 Q60,16 70,22" fill="none" stroke="#3d2b0a" strokeWidth="1.5" />
      {/* Hat band */}
      <rect x="36" y="38" width="48" height="9" rx="1" fill="#1c0f04" />
      {/* Brim */}
      <rect x="14" y="44" width="92" height="13" rx="7" fill="#7a5720" stroke="#3d2b0a" strokeWidth="2.5" />
      {/* Brim highlight */}
      <path d="M18,48 Q60,44 102,48" fill="none" stroke="#a0752e" strokeWidth="1" strokeOpacity="0.4" />

      {/* Face */}
      <ellipse cx="60" cy="67" rx="23" ry="17" fill="#f0c080" stroke="#d4956a" strokeWidth="1.5" />

      {/* Eyebrows — left raised, right level */}
      <path d="M40,57 Q48,50 56,54" fill="none" stroke="#5d3b1c" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M64,57 Q70,54 78,57" fill="none" stroke="#5d3b1c" strokeWidth="2.5" strokeLinecap="round" />

      {/* Eyes — left open, right squinting */}
      <ellipse cx="49" cy="63" rx="7" ry="7" fill="white" stroke="#222" strokeWidth="1.5" />
      <ellipse cx="71" cy="63" rx="6" ry="5" fill="white" stroke="#222" strokeWidth="1.5" />
      <circle cx="49" cy="63" r="4.5" fill="#2c4a1e" />
      <circle cx="71" cy="63" r="3.5" fill="#2c4a1e" />
      <circle cx="49" cy="63" r="2.5" fill="#111" />
      <circle cx="71" cy="63" r="2" fill="#111" />
      <circle cx="51" cy="61" r="1.5" fill="white" />
      <circle cx="73" cy="61" r="1.2" fill="white" />
      {/* Squint crease */}
      <path d="M65,60 Q71,57 77,60" fill="none" stroke="#c49a60" strokeWidth="1" strokeOpacity="0.6" />

      {/* Nose */}
      <path d="M57,71 Q60,75 63,71" fill="none" stroke="#d4956a" strokeWidth="1.5" strokeLinecap="round" />

      {/* Determined mouth */}
      <path d="M50,78 Q60,82 70,78" fill="none" stroke="#222" strokeWidth="1.5" strokeLinecap="round" />

      {/* Neck */}
      <rect x="54" y="82" width="12" height="8" rx="3" fill="#f0c080" />

      {/* Trench coat */}
      <path d="M18,88 L102,88 L110,133 L10,133 Z" fill="#6b4c1e" stroke="#3d2b0a" strokeWidth="2" />
      {/* Shirt collar V */}
      <path d="M48,88 L60,80 L72,88" fill="#e8dcc8" stroke="#c8b89a" strokeWidth="1" />
      {/* Left lapel */}
      <path d="M40,88 L22,114 L44,114 Z" fill="#7a5520" stroke="#3d2b0a" strokeWidth="1.5" />
      {/* Right lapel */}
      <path d="M80,88 L98,114 L76,114 Z" fill="#7a5520" stroke="#3d2b0a" strokeWidth="1.5" />
      {/* Belt */}
      <rect x="10" y="116" width="100" height="6" rx="2" fill="#3d2b0a" />
      <rect x="54" y="114" width="12" height="10" rx="2" fill="#6b4c1e" stroke="#3d2b0a" strokeWidth="1" />

      {/* Magnifying glass (held at right, chest-level) */}
      {/* Handle */}
      <path d="M88,112 L97,130" stroke="#3d2b0a" strokeWidth="8" strokeLinecap="round" />
      {/* Outer ring */}
      <circle cx="74" cy="100" r="18" fill="none" stroke="#3d2b0a" strokeWidth="5" />
      {/* Glass lens */}
      <circle cx="74" cy="100" r="14" fill="#f59e0b" fillOpacity="0.06" />
      {/* Golden rim */}
      <circle cx="74" cy="100" r="14" fill="none" stroke="#d97706" strokeWidth="1" strokeOpacity="0.5" />
      {/* Lens shine */}
      <ellipse cx="68" cy="93" rx="5" ry="4" fill="white" fillOpacity="0.08" />

      {/* Name bar */}
      <rect x="0" y="133" width="120" height="35" fill="#080601" />
      <line x1="0" y1="133" x2="120" y2="133" stroke="#b45309" strokeWidth="1.5" />
      <text x="60" y="155" textAnchor="middle" fontSize="11" fontWeight="800" fill="#f59e0b" letterSpacing="2" fontFamily="'Courier New', monospace">DETECTIVE</text>
      <circle cx="10" cy="151" r="2.5" fill="#78350f" />
      <circle cx="110" cy="151" r="2.5" fill="#78350f" />
    </svg>
  );
}

function CivilianFront({ width, height }: D) {
  return (
    <svg viewBox="0 0 120 168" width={width} height={height} aria-label="Civilian">
      <rect width="120" height="168" rx="10" fill="#08080e" />
      <rect x="2" y="2" width="116" height="164" rx="9" fill="none" stroke="#374151" strokeWidth="1.5" />

      {/* Hair */}
      <ellipse cx="60" cy="21" rx="23" ry="16" fill="#5d4e2a" />
      {/* Messy strand */}
      <path d="M40,16 Q36,10 38,15" fill="none" stroke="#5d4e2a" strokeWidth="3" strokeLinecap="round" />

      {/* Head */}
      <circle cx="60" cy="37" r="22" fill="#f5c5a3" stroke="#d4956a" strokeWidth="1.5" />

      {/* Sweat drop (nervous) */}
      <path d="M84,28 Q86,23 88,28 Q88,34 84,28 Z" fill="#93c5fd" fillOpacity="0.7" />

      {/* Eyebrows (raised, worried) */}
      <path d="M42,26 Q50,19 57,23" fill="none" stroke="#5d4e2a" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M63,23 Q70,19 78,26" fill="none" stroke="#5d4e2a" strokeWidth="2.5" strokeLinecap="round" />

      {/* Eyes (wide, worried) */}
      <ellipse cx="50" cy="33" rx="7" ry="8" fill="white" stroke="#222" strokeWidth="1.5" />
      <ellipse cx="70" cy="33" rx="7" ry="8" fill="white" stroke="#222" strokeWidth="1.5" />
      <circle cx="50" cy="34" r="4.5" fill="#4a3020" />
      <circle cx="70" cy="34" r="4.5" fill="#4a3020" />
      <circle cx="50" cy="34" r="3" fill="#111" />
      <circle cx="70" cy="34" r="3" fill="#111" />
      <circle cx="52" cy="31" r="1.5" fill="white" />
      <circle cx="72" cy="31" r="1.5" fill="white" />

      {/* Worry lines (below left eye) */}
      <line x1="42" y1="41" x2="46" y2="44" stroke="#d4956a" strokeWidth="1" strokeOpacity="0.5" />
      <line x1="40" y1="44" x2="43" y2="46" stroke="#d4956a" strokeWidth="1" strokeOpacity="0.4" />

      {/* Nose */}
      <circle cx="60" cy="41" r="2.5" fill="#e8a87c" />

      {/* Nervous mouth */}
      <path d="M52,49 Q56,46 60,48 Q64,50 68,49" fill="none" stroke="#222" strokeWidth="1.5" strokeLinecap="round" />

      {/* Neck */}
      <rect x="54" y="57" width="12" height="10" rx="3" fill="#f5c5a3" />

      {/* Hoodie/sweater body */}
      <rect x="14" y="65" width="92" height="68" rx="6" fill="#374151" stroke="#4b5563" strokeWidth="1.5" />
      {/* Hoodie collar */}
      <path d="M38,65 Q60,78 82,65" fill="none" stroke="#4b5563" strokeWidth="2" />
      {/* Center seam */}
      <line x1="60" y1="68" x2="60" y2="130" stroke="#4b5563" strokeWidth="1" strokeDasharray="3 4" />
      {/* Kangaroo pocket */}
      <path d="M35,100 L35,116 Q35,119 38,119 L82,119 Q85,119 85,116 L85,100" fill="none" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round" />

      {/* Name bar */}
      <rect x="0" y="133" width="120" height="35" fill="#06060c" />
      <line x1="0" y1="133" x2="120" y2="133" stroke="#374151" strokeWidth="1.5" />
      <text x="60" y="155" textAnchor="middle" fontSize="11" fontWeight="800" fill="#9ca3af" letterSpacing="2" fontFamily="'Courier New', monospace">CIVILIAN</text>
      <circle cx="10" cy="151" r="2.5" fill="#374151" />
      <circle cx="110" cy="151" r="2.5" fill="#374151" />
    </svg>
  );
}

export default function CardFront({ role, width, height }: { role: Role; width: number; height: number }) {
  switch (role) {
    case "mafia":     return <MafiaFront width={width} height={height} />;
    case "doctor":    return <DoctorFront width={width} height={height} />;
    case "detective": return <DetectiveFront width={width} height={height} />;
    case "civilian":  return <CivilianFront width={width} height={height} />;
  }
}
