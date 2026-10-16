import { useEffect, useState } from "react";
import { playTypewriterTick } from "@/lib/audio";

type Props = {
  lines: string[];
};

/** Keep in sync with api-server TYPEWRITER_* constants. */
const CHAR_DELAY_MS = 42;
const LINE_PAUSE_MS = 1000;
const START_DELAY_MS = 280;

export default function NightSummary({ lines }: Props) {
  const [completedLines, setCompletedLines] = useState<string[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [allDone, setAllDone] = useState(false);

  useEffect(() => {
    setCompletedLines([]);
    setCurrentLineIndex(0);
    setCurrentCharIndex(0);
    setAllDone(false);

    if (lines.length === 0) return;

    let cancelled = false;
    let lineIdx = 0;
    let charIdx = 0;
    const done: string[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null;

    function schedule(ms: number, fn: () => void) {
      timer = setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
    }

    function step() {
      if (cancelled) return;

      if (lineIdx >= lines.length) {
        setAllDone(true);
        return;
      }

      const line = lines[lineIdx];

      if (charIdx < line.length) {
        const next = charIdx + 1;
        const ch = line[charIdx];
        charIdx = next;
        setCurrentLineIndex(lineIdx);
        setCurrentCharIndex(next);
        // Click only for visible glyphs so silence matches blank gaps
        if (ch && !/\s/.test(ch)) playTypewriterTick();
        schedule(CHAR_DELAY_MS, step);
        return;
      }

      done.push(line);
      setCompletedLines([...done]);
      lineIdx += 1;
      charIdx = 0;
      setCurrentLineIndex(lineIdx);
      setCurrentCharIndex(0);
      schedule(LINE_PAUSE_MS, step);
    }

    schedule(START_DELAY_MS, step);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [lines]);

  const activePartial =
    currentLineIndex < lines.length
      ? lines[currentLineIndex].slice(0, currentCharIndex)
      : null;

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

        <div className="flex flex-col gap-6 min-h-[120px] md:min-h-[160px]">
          {completedLines.map((line, i) => (
            <p
              key={i}
              className="font-display text-amber-100/55 text-[1.05rem] md:text-xl leading-snug tracking-wide"
              style={{ textShadow: "0 2px 18px rgba(0,0,0,0.55)" }}
            >
              {line}
            </p>
          ))}

          {activePartial !== null && (
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
