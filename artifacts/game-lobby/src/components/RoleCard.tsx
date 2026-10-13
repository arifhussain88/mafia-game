import { useEffect, useState } from "react";
import type { Role } from "@/App";
import CardFront from "@/components/cards/CardFront";
import CardBack from "@/components/cards/CardBack";

type Props = {
  role: Role | null;
  flipped: boolean;
  width: number;
  animate?: boolean;
};

export default function RoleCard({ role, flipped, width, animate = false }: Props) {
  const height = Math.round(width * (168 / 120));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  const showTilt = !reduceMotion && !animate;

  return (
    <div
      style={{
        perspective: reduceMotion ? "none" : "900px",
        width,
        height,
        flexShrink: 0,
        transform: showTilt ? "rotateX(6deg) rotateY(-5deg)" : undefined,
        transformStyle: "preserve-3d",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          transition: animate && !reduceMotion
            ? "transform 0.85s cubic-bezier(0.34, 1.2, 0.64, 1)"
            : "none",
          transform: flipped ? "rotateY(0deg)" : "rotateY(180deg)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden" as const,
          }}
        >
          {role ? (
            <CardFront role={role} width={width} height={height} />
          ) : (
            <CardBack width={width} height={height} />
          )}
        </div>

        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden" as const,
            transform: "rotateY(180deg)",
          }}
        >
          <CardBack width={width} height={height} />
        </div>
      </div>
    </div>
  );
}
