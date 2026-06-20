import type { Role, Player } from "@/App";
import RoleCard from "@/components/RoleCard";

export type ActionMode =
  | "none"
  | "mafia-kill"
  | "doctor-protect"
  | "detective-investigate"
  | "day-vote";

type Props = {
  players: Player[];
  mySocketId: string;
  myRole: Role | null;
  mafiaIds: string[];
  selectedId: string | null;
  actionMode: ActionMode;
  onSelect: (playerId: string) => void;
  /** When provided, all cards flip simultaneously (game-over reveal mode). */
  revealAll?: boolean;
};

function getCardMetrics(N: number): { w: number; radiusPct: number } {
  if (N <= 7) return { w: 60, radiusPct: 35 };
  if (N <= 9) return { w: 52, radiusPct: 33 };
  return { w: 46, radiusPct: 31 };
}

const SELECT_SHADOW: Record<ActionMode, string> = {
  "none":                   "",
  "mafia-kill":             "0 0 14px rgba(239,68,68,0.55)",
  "doctor-protect":         "0 0 14px rgba(52,211,153,0.45)",
  "detective-investigate":  "0 0 14px rgba(251,191,36,0.45)",
  "day-vote":               "0 0 14px rgba(251,191,36,0.45)",
};

const SELECT_BORDER: Record<ActionMode, string> = {
  "none":                   "transparent",
  "mafia-kill":             "#ef4444",
  "doctor-protect":         "#34d399",
  "detective-investigate":  "#fbbf24",
  "day-vote":               "#fbbf24",
};

const FELLOW_SHADOW = "0 0 10px rgba(239,68,68,0.3)";
const FELLOW_BORDER = "#991b1b";

export default function PlayerCircle({
  players,
  mySocketId,
  myRole,
  mafiaIds,
  selectedId,
  actionMode,
  onSelect,
  revealAll,
}: Props) {
  const N = players.length;
  if (N === 0) return null;

  const { w: cardW, radiusPct } = getCardMetrics(N);
  const cardH = Math.round(cardW * (168 / 120));
  const isGameOver = revealAll !== undefined;

  const myIndex = players.findIndex((p) => p.id === mySocketId);

  function canClick(player: Player): boolean {
    if (isGameOver || !player.alive || actionMode === "none") return false;
    const isMe = player.id === mySocketId;
    if (actionMode === "mafia-kill") return !isMe && !mafiaIds.includes(player.id);
    if (actionMode === "doctor-protect") return true;
    return !isMe;
  }

  return (
    <div
      className="relative w-full mx-auto select-none"
      style={{ maxWidth: 300, aspectRatio: "1/1" }}
      aria-label="Players around the table"
    >
      {players.map((player, index) => {
        const offset = myIndex === -1 ? index : (index - myIndex + N) % N;
        const angle = Math.PI / 2 + (offset * 2 * Math.PI) / N;
        const xPct = 50 + radiusPct * Math.cos(angle);
        const yPct = 50 + radiusPct * Math.sin(angle);

        const isMe       = player.id === mySocketId;
        const eliminated = !player.alive;
        const isFellow   = !isMe && myRole === "mafia" && mafiaIds.includes(player.id);
        const isSelected = selectedId === player.id;
        const clickable  = canClick(player);

        const roleToShow: Role | null = isMe
          ? myRole
          : isGameOver && player.role
          ? player.role
          : null;

        const showFront = isGameOver ? (revealAll ?? false) : isMe;

        const borderColor = isSelected
          ? SELECT_BORDER[actionMode]
          : isFellow
          ? FELLOW_BORDER
          : "transparent";

        const shadow = isSelected
          ? SELECT_SHADOW[actionMode]
          : isFellow
          ? FELLOW_SHADOW
          : "none";

        return (
          <div
            key={player.id}
            style={{
              position: "absolute",
              left: `${xPct}%`,
              top: `${yPct}%`,
              transform: "translate(-50%, -50%)",
              zIndex: isMe ? 2 : 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
            }}
          >
            {/* Card with overlays */}
            <button
              onClick={clickable ? () => onSelect(player.id) : undefined}
              disabled={!clickable}
              style={{ display: "block", cursor: clickable ? "pointer" : "default", background: "none", border: "none", padding: 0, position: "relative" }}
              aria-label={`${player.name}${isMe ? " (you)" : ""}`}
            >
              {/* 3D Flip card */}
              <RoleCard
                role={roleToShow}
                flipped={showFront}
                width={cardW}
                animate={isGameOver}
              />

              {/* Selection / fellow ring overlay */}
              {(isSelected || isFellow) && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 10,
                    border: `2px solid ${borderColor}`,
                    boxShadow: shadow,
                    pointerEvents: "none",
                  }}
                />
              )}

              {/* Clickable hover ring (shown via CSS class) */}
              {clickable && !isSelected && !isFellow && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 10,
                    border: "2px solid transparent",
                    transition: "border-color 0.15s",
                    pointerEvents: "none",
                  }}
                  className="hover:border-gray-500"
                />
              )}

              {/* Eliminated overlay — during game: grey scrim + X */}
              {eliminated && !isGameOver && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 10,
                    background: "rgba(3,4,8,0.68)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                    pointerEvents: "none",
                  }}
                >
                  <span style={{ color: "#4b5563", fontSize: 16, lineHeight: 1 }}>✕</span>
                </div>
              )}

              {/* Eliminated overlay — game over: subtle dark tint to show deceased */}
              {eliminated && isGameOver && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 10,
                    background: "rgba(0,0,0,0.38)",
                    pointerEvents: "none",
                  }}
                />
              )}

              {/* Fellow mafia dagger badge */}
              {isFellow && !isGameOver && (
                <div
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -6,
                    background: "#7f1d1d",
                    borderRadius: "50%",
                    width: 16,
                    height: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 9,
                    pointerEvents: "none",
                  }}
                >
                  🔪
                </div>
              )}
            </button>

            {/* Name label below card */}
            <p
              style={{
                fontSize: 8,
                fontWeight: 600,
                color: isMe ? "#f3f4f6" : eliminated && !isGameOver ? "#4b5563" : "#9ca3af",
                maxWidth: cardW,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                lineHeight: 1,
                textDecoration: eliminated && !isGameOver ? "line-through" : "none",
              }}
            >
              {player.name}{isMe ? " ★" : ""}
            </p>

            {/* Offline indicator */}
            {!player.connected && !eliminated && (
              <p style={{ fontSize: 7, color: "#6b7280", lineHeight: 1, marginTop: -2 }}>offline</p>
            )}
          </div>
        );
      })}

      {/* Table surface hint */}
      <div
        className="absolute rounded-full border border-gray-800/40 pointer-events-none"
        style={{
          left: "50%",
          top: "50%",
          width: `${radiusPct * 1.35}%`,
          height: `${radiusPct * 1.35}%`,
          transform: "translate(-50%, -50%)",
          background: "radial-gradient(circle, rgba(255,255,255,0.008) 0%, transparent 70%)",
        }}
      />
    </div>
  );
}
