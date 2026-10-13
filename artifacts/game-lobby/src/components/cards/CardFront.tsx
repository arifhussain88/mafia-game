import type { Role } from "@/App";

const ROLE_BG: Record<Role, string> = {
  mafia:     "#0d0305",
  doctor:    "#031008",
  detective: "#060502",
  civilian:  "#08080e",
};

const ROLE_BORDER: Record<Role, string> = {
  mafia:     "#7f1d1d",
  doctor:    "#065f46",
  detective: "#78350f",
  civilian:  "#374151",
};

const ROLE_GLOW: Record<Role, string> = {
  mafia:     "rgba(127, 29, 29, 0.45)",
  doctor:    "rgba(6, 95, 70, 0.4)",
  detective: "rgba(120, 53, 15, 0.4)",
  civilian:  "rgba(55, 65, 81, 0.35)",
};

const ROLE_IMG: Record<Role, string> = {
  mafia:     "/role-mafia.png",
  doctor:    "/role-doctor.png",
  detective: "/role-detective.png",
  civilian:  "/role-civilian.png",
};

export default function CardFront({ role, width, height }: { role: Role; width: number; height: number }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 12,
        background: ROLE_BG[role],
        border: `2px solid ${ROLE_BORDER[role]}`,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow: `
          0 1px 0 rgba(255,255,255,0.12) inset,
          0 -2px 6px rgba(0,0,0,0.45) inset,
          0 10px 22px rgba(0,0,0,0.55),
          0 2px 4px rgba(0,0,0,0.4),
          0 0 18px ${ROLE_GLOW[role]}
        `,
        backgroundImage: `
          linear-gradient(145deg, rgba(255,255,255,0.14) 0%, transparent 38%, transparent 62%, rgba(0,0,0,0.35) 100%),
          linear-gradient(${ROLE_BG[role]}, ${ROLE_BG[role]})
        `,
      }}
    >
      <img
        src={ROLE_IMG[role]}
        alt={role}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: "block",
          userSelect: "none",
          filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.45))",
        }}
        draggable={false}
      />
    </div>
  );
}
