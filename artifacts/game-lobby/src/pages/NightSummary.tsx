import { useEffect, useState } from "react";

type Props = {
  lines: string[];
  isHost: boolean;
  onBeginDay: () => void;
};

const CHAR_DELAY_MS = 38;
const LINE_PAUSE_MS = 900;

export default function NightSummary({ lines, isHost, onBeginDay }: Props) {
  const [completedLines, setCompletedLines] = useState<string[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [allDone, setAllDone] = useState(false);

  useEffect(() => {
    setCompletedLines([]);
    setCurrentLineIndex(0);
    setCurrentCharIndex(0);
    setAllDone(false);
  }, [lines]);

  useEffect(() => {
    if (lines.length === 0) return;

    if (currentLineIndex >= lines.length) {
      setAllDone(true);
      return;
    }

    const line = lines[currentLineIndex];

    if (currentCharIndex < line.length) {
      const t = setTimeout(() => {
        setCurrentCharIndex((c) => c + 1);
      }, CHAR_DELAY_MS);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => {
        setCompletedLines((prev) => [...prev, line]);
        setCurrentLineIndex((i) => i + 1);
        setCurrentCharIndex(0);
      }, LINE_PAUSE_MS);
      return () => clearTimeout(t);
    }
  }, [lines, currentLineIndex, currentCharIndex]);

  const activePartial =
    currentLineIndex < lines.length
      ? lines[currentLineIndex].slice(0, currentCharIndex)
      : null;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{ background: "#060710" }}
    >
      <div className="w-full max-w-md md:max-w-xl flex flex-col gap-8">

        {/* Header */}
        <div className="text-center">
          <span className="text-4xl md:text-5xl">🌙</span>
          <p className="text-gray-700 text-xs md:text-sm uppercase tracking-[0.2em] mt-3 font-medium">
            Night Report
          </p>
        </div>

        {/* Horizontal rule */}
        <div
          className="w-full h-px"
          style={{ background: "linear-gradient(to right, transparent, #c8a04a44, transparent)" }}
        />

        {/* Typewriter lines */}
        <div className="flex flex-col gap-5 min-h-[120px] md:min-h-[160px]">
          {completedLines.map((line, i) => (
            <p
              key={i}
              className="text-amber-200/80 text-base md:text-lg leading-relaxed font-medium"
              style={{ textShadow: "0 0 20px rgba(200,160,74,0.2)" }}
            >
              {line}
            </p>
          ))}

          {activePartial !== null && (
            <p
              className="text-amber-200/80 text-base md:text-lg leading-relaxed font-medium"
              style={{ textShadow: "0 0 20px rgba(200,160,74,0.2)" }}
            >
              {activePartial}
              <span
                className="inline-block w-[2px] h-[1.1em] ml-[1px] align-middle animate-pulse"
                style={{ background: "#c8a04a", opacity: 0.8 }}
              />
            </p>
          )}
        </div>

        {/* Begin Day / waiting */}
        {allDone && (
          <div className="flex flex-col items-center gap-3 mt-2">
            <div
              className="w-full h-px"
              style={{ background: "linear-gradient(to right, transparent, #c8a04a44, transparent)" }}
            />
            {isHost ? (
              <button
                onClick={onBeginDay}
                className="mt-4 w-full max-w-xs py-4 rounded-2xl font-bold text-base md:text-lg tracking-wide text-gray-900 transition-all active:scale-95"
                style={{
                  background: "linear-gradient(135deg, #c8a04a 0%, #e8c46a 50%, #c8a04a 100%)",
                  boxShadow: "0 0 24px rgba(200,160,74,0.35)",
                }}
              >
                ☀️ Begin Day
              </button>
            ) : (
              <p className="text-gray-600 text-sm md:text-base mt-4 animate-pulse">
                Waiting for the host to begin the day…
              </p>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
