import { useEffect, useRef, useState } from "react";

/**
 * First screen on launch: the town at night while the game's art, fonts and
 * role cards download, with a real progress bar (the big background image is
 * streamed so the bar moves with actual bytes). Never blocks forever: after
 * MAX_WAIT_MS it continues and the rest keeps loading in the background.
 */

/** Key art with the title painted in (same image as the Android app's first screen). */
const LOADING_ART = "/loading-art.jpg";
/** The in-game background, fetched now so Home appears fully drawn. */
const BACKGROUND = "/background-mobile.jpg";
const ROLE_ART = ["mafia", "detective", "doctor", "civilian"].map((r) => `/roles/${r}.webp`);
const MIN_SHOW_MS = 1400;

type BootWindow = Window & {
  /** Set by the Android app: share of the bar it already covered loading the page. */
  __MAFIA_APP_BOOT?: number;
  ReactNativeWebView?: { postMessage: (msg: string) => void };
};
const MAX_WAIT_MS = 12000;

const LINES = [
  "Lighting the streetlamps…",
  "Shuffling the roles…",
  "Locking the doors…",
  "Counting the suspects…",
  "Cleaning up the alley…",
  "Waking the town…",
];

/** Download a URL, reporting 0..1 as bytes arrive (falls back to done-at-end). */
async function fetchWithProgress(url: string, onProgress: (f: number) => void): Promise<void> {
  const res = await fetch(url, { cache: "force-cache" });
  const total = Number(res.headers.get("content-length")) || 0;
  if (!res.body || !total) {
    await res.arrayBuffer();
    onProgress(1);
    return;
  }
  const reader = res.body.getReader();
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    onProgress(Math.min(1, received / total));
  }
  onProgress(1);
}

export default function LoadingScreen({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const [bgReady, setBgReady] = useState(false);
  const [line, setLine] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    const started = performance.now();
    const w = window as BootWindow;
    // In the app, the native screen already showed the page download (0..base);
    // continue the same bar from there, and tell it to step aside.
    const base = typeof w.__MAFIA_APP_BOOT === "number" ? Math.min(0.9, Math.max(0, w.__MAFIA_APP_BOOT)) : 0;
    w.ReactNativeWebView?.postMessage(JSON.stringify({ type: "splash" }));
    // Weighted parts: the background is most of the bytes.
    const parts = { art: 0, bg: 0, roles: 0, fonts: 0 };
    const update = () =>
      setProgress(base + (1 - base) * (parts.art * 0.4 + parts.bg * 0.32 + parts.roles * 0.18 + parts.fonts * 0.1));
    update();

    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      setProgress(1);
      const wait = Math.max(0, MIN_SHOW_MS - (performance.now() - started));
      window.setTimeout(() => {
        setLeaving(true);
        window.setTimeout(onDone, 450);
      }, wait + 250);
    };

    const art = fetchWithProgress(LOADING_ART, (f) => {
      parts.art = f;
      update();
    })
      .then(() => setBgReady(true))
      .catch(() => { parts.art = 1; update(); });

    const bg = fetchWithProgress(BACKGROUND, (f) => {
      parts.bg = f;
      update();
    }).catch(() => { parts.bg = 1; update(); });

    let rolesDone = 0;
    const roles = Promise.all(
      ROLE_ART.map((url) =>
        fetch(url, { cache: "force-cache" })
          .then((r) => r.arrayBuffer())
          .catch(() => undefined)
          .finally(() => {
            rolesDone += 1;
            parts.roles = rolesDone / ROLE_ART.length;
            update();
          }),
      ),
    );

    const fonts = (document.fonts?.ready ?? Promise.resolve())
      .catch(() => undefined)
      .finally(() => { parts.fonts = 1; update(); });

    void Promise.all([art, bg, roles, fonts]).then(finish);
    const giveUp = window.setTimeout(finish, MAX_WAIT_MS);
    const cycle = window.setInterval(() => setLine((n) => (n + 1) % LINES.length), 1600);
    return () => {
      window.clearTimeout(giveUp);
      window.clearInterval(cycle);
    };
  }, [onDone]);

  const pct = Math.round(progress * 100);

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center overflow-hidden bg-[#07080c] transition-opacity duration-500 ${bgReady ? "justify-center" : "justify-end"} ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
      role="progressbar"
      aria-label="Loading the game"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      {/* Blurred, darkened copy fills any space the full picture doesn't cover. */}
      <div
        aria-hidden
        className={`absolute inset-0 scale-110 bg-cover bg-center blur-2xl brightness-[0.4] transition-opacity duration-1000 ${bgReady ? "opacity-100" : "opacity-0"}`}
        style={{ backgroundImage: `url(${LOADING_ART})` }}
      />
      {/* The whole key art, never cropped, so the painted title is always readable. */}
      {bgReady && (
        <img
          src={LOADING_ART}
          alt=""
          aria-hidden
          className="relative z-10 w-full max-w-[480px] max-h-[84vh] object-contain"
          style={{ animation: "splashFadeIn 700ms ease-out" }}
        />
      )}

      <div className={`relative z-10 flex w-full max-w-xs flex-col items-center px-6 text-center ${bgReady ? "mt-2" : "mb-[14vh]"}`}>
        {/* Text title only until the art (which has the title painted in) arrives. */}
        {!bgReady && (
        <>
        <h1 className="font-display text-6xl font-bold tracking-tight drop-shadow-[0_4px_18px_rgba(0,0,0,0.8)]">
          <span className="text-gold-title">Mafia</span>
        </h1>
        <p className="mt-1 text-[11px] uppercase tracking-[0.3em] text-amber-200/80">Town has a problem</p>
        </>
        )}

        <div className={`w-full ${bgReady ? "" : "mt-10"}`}>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-black/60 ring-1 ring-amber-200/15">
            <div
              className="relative h-full rounded-full bar-gold transition-[width] duration-300 ease-out"
              style={{ width: `${Math.max(3, pct)}%` }}
            >
              <span
                aria-hidden
                className="absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/45 to-transparent"
                style={{ animation: "splashShine 1.6s ease-in-out infinite" }}
              />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span key={line} className="text-amber-100/70" style={{ animation: "splashFade 1.6s ease-in-out" }}>
              {pct >= 100 ? "The town is ready." : LINES[line]}
            </span>
            <span className="font-mono tabular-nums text-amber-200/90">{pct}%</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes splashShine { from { transform: translateX(0); } to { transform: translateX(400%); } }
        @keyframes splashFade { 0% { opacity: 0; transform: translateY(3px); } 15%, 85% { opacity: 1; transform: none; } 100% { opacity: 0.2; } }
        @keyframes splashFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          [style*="splashShine"], [style*="splashDrift"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
