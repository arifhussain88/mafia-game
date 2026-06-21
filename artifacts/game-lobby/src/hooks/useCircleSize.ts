import { useState, useEffect } from "react";

const BREAKPOINT = 768;
const MAX_SIZE = 620;

function compute(): number {
  if (typeof window === "undefined") return 300;
  if (window.innerWidth < BREAKPOINT) return 300;
  return Math.min(
    Math.round(window.innerHeight * 0.70),
    Math.round(window.innerWidth * 0.65),
    MAX_SIZE,
  );
}

export function useCircleSize(): number {
  const [size, setSize] = useState(compute);

  useEffect(() => {
    function update() { setSize(compute()); }
    window.addEventListener("resize", update);
    update();
    return () => window.removeEventListener("resize", update);
  }, []);

  return size;
}
