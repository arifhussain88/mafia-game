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

  return (
    <div style={{ perspective: "600px", width, height, flexShrink: 0 }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          transition: animate ? "transform 0.75s cubic-bezier(0.4, 0, 0.2, 1)" : "none",
          transform: flipped ? "rotateY(0deg)" : "rotateY(180deg)",
        }}
      >
        {/* Front face */}
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

        {/* Back face */}
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
