import { useEffect, useState } from "react";

type Props = {
  /** Display text. Change the string (or append a unique suffix) to re-trigger. */
  message: string | null;
};

const SHOW_MS = 4500;

function displayText(raw: string): string {
  const cut = raw.indexOf("\u200B");
  return cut >= 0 ? raw.slice(0, cut) : raw;
}

export default function MatchTicker({ message }: Props) {
  const [visible, setVisible] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    setVisible(displayText(message));
    const t = setTimeout(() => setVisible(null), SHOW_MS);
    return () => clearTimeout(t);
  }, [message]);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed top-3 left-1/2 z-[60] w-[min(92vw,28rem)] -translate-x-1/2"
      role="status"
      aria-live="polite"
    >
      <div
        className="rounded-full border border-amber-900/50 bg-black/75 px-4 py-2 text-center shadow-[0_8px_28px_rgba(0,0,0,0.55)] backdrop-blur-sm"
        style={{ animation: "matchTickerIn 0.35s ease-out" }}
      >
        <p className="font-display text-sm text-amber-100/95 tracking-wide">{visible}</p>
      </div>
      <style>{`
        @keyframes matchTickerIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
