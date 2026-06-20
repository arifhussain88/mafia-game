import type { Role, Player } from "@/App";
import MafiaIcon from "@/components/icons/MafiaIcon";
import DoctorIcon from "@/components/icons/DoctorIcon";
import DetectiveIcon from "@/components/icons/DetectiveIcon";
import CivilianIcon from "@/components/icons/CivilianIcon";

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
};

function RoleIcon({ role, size }: { role: Role; size: number }) {
  switch (role) {
    case "mafia":     return <MafiaIcon size={size} />;
    case "doctor":    return <DoctorIcon size={size} />;
    case "detective": return <DetectiveIcon size={size} />;
    case "civilian":  return <CivilianIcon size={size} />;
  }
}

const ROLE_BORDER: Record<Role, string> = {
  mafia:     "border-red-700",
  doctor:    "border-emerald-700",
  detective: "border-amber-700",
  civilian:  "border-gray-600",
};
const ROLE_BG: Record<Role, string> = {
  mafia:     "bg-red-950/50",
  doctor:    "bg-emerald-950/50",
  detective: "bg-amber-950/40",
  civilian:  "bg-gray-900/70",
};
const ROLE_LABEL_COLOR: Record<Role, string> = {
  mafia:     "text-red-500",
  doctor:    "text-emerald-500",
  detective: "text-amber-500",
  civilian:  "text-gray-500",
};
const SELECT_STYLE: Record<ActionMode, string> = {
  "none":                    "",
  "mafia-kill":              "border-red-500 bg-red-950/50 shadow-[0_0_14px_rgba(239,68,68,0.45)]",
  "doctor-protect":          "border-emerald-500 bg-emerald-950/40 shadow-[0_0_14px_rgba(52,211,153,0.35)]",
  "detective-investigate":   "border-amber-500 bg-amber-950/40 shadow-[0_0_14px_rgba(251,191,36,0.35)]",
  "day-vote":                "border-amber-500 bg-amber-950/40 shadow-[0_0_14px_rgba(251,191,36,0.35)]",
};

const RADIUS_PCT = 36;

export default function PlayerCircle({
  players,
  mySocketId,
  myRole,
  mafiaIds,
  selectedId,
  actionMode,
  onSelect,
}: Props) {
  const N = players.length;
  if (N === 0) return null;

  const myIndex = players.findIndex((p) => p.id === mySocketId);

  function canClick(player: Player): boolean {
    if (!player.alive || actionMode === "none") return false;
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
        const xPct = 50 + RADIUS_PCT * Math.cos(angle);
        const yPct = 50 + RADIUS_PCT * Math.sin(angle);

        const isMe       = player.id === mySocketId;
        const eliminated = !player.alive;
        const isFellow   = !isMe && myRole === "mafia" && mafiaIds.includes(player.id);
        const isSelected = selectedId === player.id;
        const clickable  = canClick(player);

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
            {isMe ? (
              /* ── My card — face-up with role ── */
              <div
                className={`w-14 h-[76px] rounded-xl border-2 flex flex-col items-center justify-center gap-[2px] px-1 shadow-lg ${
                  myRole ? ROLE_BG[myRole] : "bg-gray-900"
                } ${myRole ? ROLE_BORDER[myRole] : "border-gray-600"}`}
              >
                {myRole && <RoleIcon role={myRole} size={22} />}
                <p className="text-white text-[9px] font-semibold w-full text-center truncate leading-tight">
                  {player.name}
                </p>
                <p className={`text-[7px] font-bold uppercase tracking-wide ${myRole ? ROLE_LABEL_COLOR[myRole] : "text-gray-500"}`}>
                  {myRole ?? "—"}
                </p>
              </div>
            ) : eliminated ? (
              /* ── Eliminated — greyed in place ── */
              <div className="w-14 h-[76px] rounded-xl border border-gray-800 bg-gray-950 flex flex-col items-center justify-center gap-1 opacity-35">
                <span className="text-gray-600 text-lg leading-none">✕</span>
                <p className="text-gray-600 text-[8px] w-full text-center px-1 line-through leading-tight truncate">
                  {player.name}
                </p>
                <p className="text-[6px] text-gray-700 uppercase tracking-wide">out</p>
              </div>
            ) : (
              /* ── Card back — other live players ── */
              <button
                onClick={clickable ? () => onSelect(player.id) : undefined}
                disabled={!clickable}
                className={`w-14 h-[76px] rounded-xl border-2 flex flex-col items-center justify-center gap-[3px] px-1 transition-all duration-150 ${
                  isSelected
                    ? SELECT_STYLE[actionMode]
                    : isFellow
                    ? "border-red-900/60 bg-red-950/25 hover:border-red-700"
                    : clickable
                    ? "border-gray-700 bg-gray-900 hover:border-gray-500 active:scale-95"
                    : "border-gray-800 bg-gray-900/60 cursor-default"
                }`}
              >
                <span
                  className={`text-[18px] leading-none ${
                    isSelected ? "text-white" : isFellow ? "text-red-700" : "text-gray-600"
                  }`}
                >
                  {isFellow ? "🔪" : "?"}
                </span>
                <p
                  className={`text-[9px] font-medium w-full text-center truncate leading-tight ${
                    isSelected ? "text-white" : "text-gray-300"
                  }`}
                >
                  {player.name}
                </p>
                {!player.connected && (
                  <span className="text-[6px] text-gray-600 leading-none">offline</span>
                )}
              </button>
            )}
          </div>
        );
      })}

      {/* Subtle table surface hint */}
      <div
        className="absolute rounded-full border border-gray-800/40 pointer-events-none"
        style={{
          left: "50%",
          top: "50%",
          width: `${RADIUS_PCT * 1.4}%`,
          height: `${RADIUS_PCT * 1.4}%`,
          transform: "translate(-50%, -50%)",
          background: "radial-gradient(circle, rgba(255,255,255,0.01) 0%, transparent 70%)",
        }}
      />
    </div>
  );
}
