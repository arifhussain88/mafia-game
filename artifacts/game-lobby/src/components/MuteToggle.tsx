import { useState } from "react";
import { isMuted, setMuted } from "@/lib/audio";

export default function MuteToggle() {
  const [muted, setMutedState] = useState(isMuted);

  function toggle() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    try {
      window.dispatchEvent(new CustomEvent("mafia-muted-changed", { detail: next }));
    } catch {}
  }

  return (
    <button
      onClick={toggle}
      className="fixed top-3 right-3 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-black/60 border border-gray-700 text-white hover:opacity-90 transition-all backdrop-blur-sm"
      title={muted ? "Unmute" : "Mute"}
      aria-label={muted ? "Unmute sounds" : "Mute sounds"}
    >
      {muted ? (
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.784L4.59 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.59l3.793-3.784a1 1 0 011-.14zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"/>
          <line x1="3" y1="3" x2="17" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.784L4.59 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.59l3.793-3.784a1 1 0 011-.14zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"/>
        </svg>
      )}
    </button>
  );
}
