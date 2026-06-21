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
        borderRadius: 10,
        background: ROLE_BG[role],
        border: `1.5px solid ${ROLE_BORDER[role]}`,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
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
        }}
        draggable={false}
      />
    </div>
  );
}
