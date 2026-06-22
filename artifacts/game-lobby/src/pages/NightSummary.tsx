import { useEffect, useState } from "react";

type Props = {
  lines: string[];
};

const CHAR_DELAY_MS = 38;
const LINE_PAUSE_MS = 900;

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

        {/* After all lines finish: "Day begins soon…" */}
        {allDone && (
          <div
            className="flex flex-col items-center gap-4 mt-2"
            style={{
              animation: "fadeIn 0.6s ease forwards",
            }}
          >
            <div
              className="w-full h-px"
              style={{ background: "linear-gradient(to right, transparent, #c8a04a44, transparent)" }}
            />
            <div className="flex items-center gap-3 mt-2">
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: "#c8a04a" }}
              />
              <p className="text-amber-700/70 text-sm md:text-base font-medium tracking-wide">
                Day begins soon…
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
      `}</style>
    </div>
  );
}
