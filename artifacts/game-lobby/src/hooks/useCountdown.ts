import { useState, useEffect } from "react";

export function useCountdown(endsAt: number | null): number {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!endsAt) {
      setRemaining(0);
      return;
    }
    const update = () => {
      setRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    };
    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [endsAt]);

  return remaining;
}
