import { useEffect, useMemo, useState } from "react";
import { scheduleKeyStrokes, type KeyStroke } from "@/lib/audio";

type Props = {
  lines: string[];
};

/** Keep in sync with api-server TYPEWRITER_* constants. */
const CHAR_DELAY_MS = 42;
const LINE_PAUSE_MS = 1000;
const START_DELAY_MS = 280;

type LineTiming = { start: number; end: number };

/**
 * One timeline drives both the text and the key sounds. Character k of a line
 * appears at line.start + k * CHAR_DELAY_MS, the line completes ("Enter") one
 * beat after its last character, then LINE_PAUSE_MS before the next line.
 * This mirrors computeTypewriterDuration on the server.
 */
function buildTimeline(lines: string[]) {
  const timings: LineTiming[] = [];
  const strokes: KeyStroke[] = [];
  let t = START_DELAY_MS;
  for (const line of lines) {
    const start = t;
    for (let k = 0; k < line.length; k++) {
      strokes.push({ at: (start + k * CHAR_DELAY_MS) / 1000, kind: /\s/.test(line[k]) ? "space" : "key" });
    }
    const end = start + line.length * CHAR_DELAY_MS;
    strokes.push({ at: end / 1000, kind: "enter" });
    timings.push({ start, end });
    t = end + LINE_PAUSE_MS;
  }
  return { timings, strokes, total: t };
}

export default function NightSummary({ lines }: Props) {
  const timeline = useMemo(() => buildTimeline(lines), [lines]);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(0);
    if (lines.length === 0) return;

    const startedAt = performance.now();
    const cancelSound = scheduleKeyStrokes(timeline.strokes, startedAt);
    let raf = 0;

    // Reveal from elapsed wall time (not a chain of timers), so the text can
    // never drift from the audio clock and catches up after a background tab.
    // A tiny component, so re-rendering each frame for ~10s is cheap.
    const tick = () => {
      const now = performance.now() - startedAt;
      setElapsed(now);
      if (now < timeline.total) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // rAF pauses in background tabs; a slow interval keeps state honest there.
    const fallback = window.setInterval(() => setElapsed(performance.now() - startedAt), 500);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(fallback);
      cancelSound();
    };
  }, [lines, timeline]);

  const completedLines: string[] = [];
  let activePartial: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const { start, end } = timeline.timings[i];
    if (elapsed >= end) {
      completedLines.push(lines[i]);
      continue;
    }
    if (elapsed >= start) {
      // +1: the character scheduled exactly at `start` is visible at `start`.
      const chars = Math.min(lines[i].length, Math.floor((elapsed - start) / CHAR_DELAY_MS) + 1);
      activePartial = lines[i].slice(0, chars);
    }
    break;
  }
  const allDone = lines.length > 0 && elapsed >= timeline.total;
  // Between lines (the pause) keep a blinking caret on an empty new line.
  const betweenLines = !allDone && activePartial === null && completedLines.length < lines.length;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="game-panel w-full max-w-md md:max-w-xl px-6 py-8 flex flex-col gap-8">

        <div className="text-center">
          <p className="font-display text-amber-100/55 text-xs md:text-sm uppercase tracking-[0.35em] font-medium">
            Night Report
          </p>
        </div>

        <div
          className="w-full h-px"
          style={{ background: "linear-gradient(to right, transparent, rgba(212,175,95,0.35), transparent)" }}
        />

        <div className="flex flex-col gap-6 min-h-[120px] md:min-h-[160px]" aria-live="polite">
          {completedLines.map((line, i) => (
            <p
              key={i}
              className="font-display text-amber-100/55 text-[1.05rem] md:text-xl leading-snug tracking-wide"
              style={{ textShadow: "0 2px 18px rgba(0,0,0,0.55)" }}
            >
              {line}
            </p>
          ))}

          {(activePartial !== null || betweenLines) && (
            <p
              className="font-display text-amber-50/95 text-[1.05rem] md:text-xl leading-snug tracking-wide"
              style={{ textShadow: "0 0 24px rgba(212,175,95,0.22), 0 2px 14px rgba(0,0,0,0.5)" }}
            >
              {activePartial}
              <span
                className="inline-block w-[2px] h-[1.05em] ml-[2px] align-[-0.12em]"
                style={{
                  background: "linear-gradient(180deg, #f5e6c0, #c8a04a)",
                  boxShadow: "0 0 8px rgba(200,160,74,0.55)",
                  animation: "nightCaret 0.9s steps(1) infinite",
                }}
              />
            </p>
          )}
        </div>

        {allDone && (
          <div
            className="flex flex-col items-center gap-4 mt-2"
            style={{ animation: "fadeIn 0.6s ease forwards" }}
          >
            <div
              className="w-full h-px"
              style={{ background: "linear-gradient(to right, transparent, rgba(212,175,95,0.28), transparent)" }}
            />
            <div className="flex items-center gap-3 mt-2">
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: "#c8a04a" }}
              />
              <p className="font-display text-amber-200/45 text-sm md:text-base tracking-[0.18em] uppercase">
                Day begins soon
              </p>
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: "#c8a04a", animationDelay: "0.3s" }}
              />
            </div>
          </div>
        )}

      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes nightCaret {
          0%, 49% { opacity: 0.9; }
          50%, 100% { opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes nightCaret {
            0%, 100% { opacity: 0.7; }
          }
        }
      `}</style>
    </div>
  );
}
