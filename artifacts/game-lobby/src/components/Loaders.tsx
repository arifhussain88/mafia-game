import { useEffect, useState } from "react";

/**
 * Ring spinner for every wait. "gold" on dark backgrounds; "ink" inside gold
 * buttons, where it takes the button's dark text colour.
 */
export function GoldSpinner({ size = 20, className = "", tone = "gold" }: { size?: number; className?: string; tone?: "gold" | "ink" }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block shrink-0 animate-spin rounded-full border-2 ${tone === "ink" ? "border-current/25 border-t-current" : "border-[#fde68a]/20 border-t-[#fde68a]"} ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/** Show something only after `delayMs`, so fast responses never flash a loader. */
export function useDelayed(active: boolean, delayMs = 400): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) {
      setShown(false);
      return;
    }
    const t = window.setTimeout(() => setShown(true), delayMs);
    return () => window.clearTimeout(t);
  }, [active, delayMs]);
  return shown;
}

export type ConnectionStatus = "idle" | "connecting" | "online" | "reconnecting";

/**
 * Slim moving gold bar along the top edge plus a small pill while the game
 * server isn't reachable, so slow or dropped connections are visible instead
 * of buttons that silently do nothing.
 */
export function ConnectionIndicator({ status }: { status: ConnectionStatus }) {
  const waiting = status === "connecting" || status === "reconnecting";
  const visible = useDelayed(waiting, status === "reconnecting" ? 300 : 700);
  if (!visible) return null;
  return (
    <>
      <div aria-hidden className="fixed inset-x-0 top-0 z-[90] h-[3px] overflow-hidden bg-black/40">
        <div className="bar-gold h-full w-1/3" style={{ animation: "loaderSweep 1.2s ease-in-out infinite" }} />
      </div>
      <div
        role="status"
        aria-live="polite"
        className="fixed left-1/2 top-3 z-[90] flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/80 px-3.5 py-1.5 text-xs text-amber-100 ring-1 ring-amber-700/40 backdrop-blur-sm"
      >
        <GoldSpinner size={12} />
        {status === "reconnecting" ? "Connection lost. Reconnecting…" : "Connecting to the town…"}
      </div>
      <style>{`@keyframes loaderSweep { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }`}</style>
    </>
  );
}

/** Full-screen wait used while the game puts you back in your seat. */
export function BusyOverlay({ title, detail }: { title: string; detail?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-4 bg-black/70 px-6 text-center backdrop-blur-sm"
    >
      <GoldSpinner size={36} />
      <p className="font-display text-xl text-amber-100">{title}</p>
      {detail && <p className="max-w-xs text-sm text-gray-400">{detail}</p>}
    </div>
  );
}
