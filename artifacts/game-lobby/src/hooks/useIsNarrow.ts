import { useState, useEffect } from "react";

/** Same breakpoint as useCircleSize / Tailwind `md`. */
export const NARROW_BREAKPOINT = 768;

function compute(): boolean {
  if (typeof window === "undefined") return true;
  return window.innerWidth < NARROW_BREAKPOINT;
}

export function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(compute);

  useEffect(() => {
    function update() {
      setNarrow(compute());
    }
    window.addEventListener("resize", update);
    update();
    return () => window.removeEventListener("resize", update);
  }, []);

  return narrow;
}
