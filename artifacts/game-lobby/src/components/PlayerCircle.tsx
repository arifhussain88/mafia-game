import type { Role, Player } from "@/App";
import RoleCard from "@/components/RoleCard";
import { useIsNarrow } from "@/hooks/useIsNarrow";

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
  /** Circle container diameter in px. Defaults to 300 (mobile). Pass larger values for desktop. */
  circleSize?: number;
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

const BASE_SIZE = 300;
const STACK_CARD_W = 100;

type SeatMetrics = {
  cardW: number;
  cardH: number;
  nameFontSize: number;
  offlineFontSize: number;
  badgeSize: number;
  badgeFontSize: number;
  badgeOffset: number;
  scale: number;
};

function PlayerSeat({
  player,
  mySocketId,
  myRole,
  mafiaIds,
  selectedId,
  actionMode,
  onSelect,
  isGameOver,
  revealAll,
  metrics,
}: {
  player: Player;
  mySocketId: string;
  myRole: Role | null;
  mafiaIds: string[];
  selectedId: string | null;
  actionMode: ActionMode;
  onSelect: (playerId: string) => void;
  isGameOver: boolean;
  revealAll?: boolean;
  metrics: SeatMetrics;
}) {
  const {
    cardW,
    nameFontSize,
    offlineFontSize,
    badgeSize,
    badgeFontSize,
    badgeOffset,
    scale,
  } = metrics;

  const isMe = player.id === mySocketId;
  const eliminated = !player.alive;
  const isFellow = !isMe && myRole === "mafia" && mafiaIds.includes(player.id);
  const isSelected = selectedId === player.id;

  let clickable = false;
  if (!isGameOver && player.alive && actionMode !== "none") {
    if (actionMode === "mafia-kill") clickable = !isMe && !mafiaIds.includes(player.id);
    else if (actionMode === "doctor-protect") clickable = true;
    else clickable = !isMe;
  }

  const roleToShow: Role | null = isMe
    ? myRole
    : isGameOver && player.role
      ? player.role
      : null;

  const showFront = isGameOver ? (revealAll ?? false) : isMe;

  // After day-vote lock, actionMode becomes "none" but selectedId remains — keep amber ring
  const selectedBorder =
    actionMode === "none" && isSelected ? SELECT_BORDER["day-vote"] : SELECT_BORDER[actionMode];
  const selectedShadow =
    actionMode === "none" && isSelected ? SELECT_SHADOW["day-vote"] : SELECT_SHADOW[actionMode];

  const borderColor = isSelected
    ? selectedBorder
    : isFellow
      ? FELLOW_BORDER
      : "transparent";

  const shadow = isSelected
    ? selectedShadow
    : isFellow
      ? FELLOW_SHADOW
      : "none";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: Math.round(3 * scale),
      }}
    >
      <button
        type="button"
        onClick={clickable ? () => onSelect(player.id) : undefined}
        disabled={!clickable}
        style={{
          display: "block",
          cursor: clickable ? "pointer" : "default",
          background: "none",
          border: "none",
          padding: 0,
          position: "relative",
        }}
        aria-label={`${player.name}${isMe ? " (you)" : ""}`}
      >
        <RoleCard
          role={roleToShow}
          flipped={showFront}
          width={cardW}
          animate={isGameOver}
        />

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
            <span style={{ color: "#4b5563", fontSize: Math.round(16 * scale), lineHeight: 1 }}>✕</span>
          </div>
        )}

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

        {isFellow && !isGameOver && (
          <div
            style={{
              position: "absolute",
              top: -badgeOffset,
              right: -badgeOffset,
              background: "#7f1d1d",
              borderRadius: "50%",
              width: badgeSize,
              height: badgeSize,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: badgeFontSize,
              pointerEvents: "none",
            }}
          >
            🔪
          </div>
        )}
      </button>

      <p
        style={{
          fontSize: nameFontSize,
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

      {!player.connected && !eliminated && (
        <p style={{ fontSize: offlineFontSize, color: "#6b7280", lineHeight: 1, marginTop: -2 }}>
          offline
        </p>
      )}
    </div>
  );
}

export default function PlayerCircle({
  players,
  mySocketId,
  myRole,
  mafiaIds,
  selectedId,
  actionMode,
  onSelect,
  revealAll,
  circleSize = BASE_SIZE,
}: Props) {
  const N = players.length;
  const isNarrow = useIsNarrow();
  if (N === 0) return null;

  const isGameOver = revealAll !== undefined;
  const useStack = isNarrow;

  if (useStack) {
    const scale = STACK_CARD_W / 60;
    const metrics: SeatMetrics = {
      cardW: STACK_CARD_W,
      cardH: Math.round(STACK_CARD_W * (168 / 120)),
      nameFontSize: 12,
      offlineFontSize: 10,
      badgeSize: 18,
      badgeFontSize: 10,
      badgeOffset: 6,
      scale,
    };

    return (
      <div
        className="w-full max-w-sm flex flex-col items-center gap-4 overflow-y-auto select-none px-2"
        style={{ maxHeight: "58vh" }}
        aria-label="Players"
      >
        {players.map((player) => (
          <PlayerSeat
            key={player.id}
            player={player}
            mySocketId={mySocketId}
            myRole={myRole}
            mafiaIds={mafiaIds}
            selectedId={selectedId}
            actionMode={actionMode}
            onSelect={onSelect}
            isGameOver={isGameOver}
            revealAll={revealAll}
            metrics={metrics}
          />
        ))}
      </div>
    );
  }

  const scale = circleSize / BASE_SIZE;
  const { w: baseCardW, radiusPct } = getCardMetrics(N);
  const cardW = Math.round(baseCardW * scale);
  const metrics: SeatMetrics = {
    cardW,
    cardH: Math.round(cardW * (168 / 120)),
    nameFontSize: Math.max(7, Math.round(8 * scale)),
    offlineFontSize: Math.max(6, Math.round(7 * scale)),
    badgeSize: Math.round(16 * scale),
    badgeFontSize: Math.round(9 * scale),
    badgeOffset: Math.round(6 * scale),
    scale,
  };

  const myIndex = players.findIndex((p) => p.id === mySocketId);

  return (
    <div
      className="relative select-none"
      style={{ width: circleSize, height: circleSize, flexShrink: 0 }}
      aria-label="Players around the table"
    >
      {players.map((player, index) => {
        const offset = myIndex === -1 ? index : (index - myIndex + N) % N;
        const angle = Math.PI / 2 + (offset * 2 * Math.PI) / N;
        const xPct = 50 + radiusPct * Math.cos(angle);
        const yPct = 50 + radiusPct * Math.sin(angle);
        const isMe = player.id === mySocketId;

        return (
          <div
            key={player.id}
            style={{
              position: "absolute",
              left: `${xPct}%`,
              top: `${yPct}%`,
              transform: "translate(-50%, -50%)",
              zIndex: isMe ? 2 : 1,
            }}
          >
            <PlayerSeat
              player={player}
              mySocketId={mySocketId}
              myRole={myRole}
              mafiaIds={mafiaIds}
              selectedId={selectedId}
              actionMode={actionMode}
              onSelect={onSelect}
              isGameOver={isGameOver}
              revealAll={revealAll}
              metrics={metrics}
            />
          </div>
        );
      })}

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
