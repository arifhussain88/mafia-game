import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, Loader2, Share2 } from "lucide-react";
import { shareText } from "@/lib/invite";

export type RoleStat = { role: string; games: number; wins: number; winRate: number };
export type ProfileData = {
  name: string;
  since: string;
  totals: { games: number; wins: number; winRate: number; streak: number };
  byRole: RoleStat[];
  best: (RoleStat & { highlight: string }) | null;
  recent: { role: string | null; result: "won" | "lost" | "draw"; outcome: string; endedAt: string }[];
};

const ROLE_LABEL: Record<string, string> = { mafia: "Mafia", detective: "Detective", doctor: "Doctor", civilian: "Civilian" };
const roleLabel = (r: string | null) => (r ? ROLE_LABEL[r] ?? r : "Unknown");

/** Load your profile. Re-fetches whenever `refreshKey` changes (e.g. back on Home after a match). */
export function useProfile(token: string | null, refreshKey: unknown) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [failed, setFailed] = useState(false);
  const [bump, setBump] = useState(0);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setFailed(false);
    fetch("/api/profile/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((json: ProfileData) => { if (!cancelled) setData(json); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [token, refreshKey, bump]);
  return { data, failed, reload: () => setBump((n) => n + 1) };
}

function WinRing({ percent, size = 44 }: { percent: number; size?: number }) {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#9c7424"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${(percent / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="600" fill="#f0d995">
        {percent}%
      </text>
    </svg>
  );
}

/** Compact card on Home. Tapping it opens the full profile. */
export function ProfileStrip({ name, data, onOpen }: { name: string; data: ProfileData | null; onOpen: () => void }) {
  const games = data?.totals.games ?? 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mb-5 flex w-full items-center gap-3 rounded-xl bg-black/40 px-3 py-3 text-left ring-1 ring-amber-700/40 transition-colors hover:bg-black/55 cursor-pointer"
      aria-label="Open your profile"
    >
      {games > 0 ? (
        <WinRing percent={data!.totals.winRate} />
      ) : (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-950/60 text-sm font-bold text-amber-200">
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-white">{name}</p>
        <p className="truncate text-xs text-gray-400">
          {!data
            ? "Loading your record…"
            : games === 0
              ? "Play your first game to start your record"
              : `${games} ${games === 1 ? "game" : "games"}${data.best ? ` · best as ${roleLabel(data.best.role)}` : ""}`}
        </p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-gray-500" aria-hidden />
    </button>
  );
}

function Tile({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-xl bg-black/40 px-2 py-3 text-center ring-1 ring-white/10">
      <p className="text-lg font-bold text-white tabular-nums">{value}</p>
      <p className="text-[11px] text-gray-500">{label}</p>
    </div>
  );
}

function timeAgo(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

/** Full profile: best-role spotlight, totals, role breakdown, recent matches. */
export function ProfileScreen({
  name,
  data,
  failed,
  onBack,
  onLogout,
  onReload,
}: {
  name: string;
  data: ProfileData | null;
  failed: boolean;
  onBack: () => void;
  onLogout: () => void;
  onReload?: () => void;
}) {
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);

  /** Dev builds only: fill the profile with sample matches to preview the screen. */
  async function loadDemo() {
    setDemoBusy(true);
    try {
      const token = localStorage.getItem("mafia-token");
      await fetch("/api/dev/demo-history", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      onReload?.();
    } finally {
      setDemoBusy(false);
    }
  }
  const since = data ? new Date(data.since).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "";

  async function shareRecord() {
    if (!data) return;
    const best = data.best ? ` Best as ${roleLabel(data.best.role)}: ${data.best.highlight}.` : "";
    const text = `I've won ${data.totals.wins} of ${data.totals.games} games (${data.totals.winRate}%) in Mafia: Town Has a Problem.${best} Think you can catch me?`;
    const result = await shareText(text, window.location.origin);
    if (result === "copied") {
      setShareNote("Copied, paste it anywhere");
      setTimeout(() => setShareNote(null), 2500);
    }
  }

  return (
    <div className="game-panel px-5 py-5">
      <div className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:text-white cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </button>
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-950/60 text-base font-bold text-amber-200">
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate font-display text-xl font-bold text-white">{name}</p>
          {since && <p className="text-xs text-gray-500">Playing since {since}</p>}
        </div>
      </div>

      {!data && !failed && (
        <div className="flex justify-center py-10 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin" aria-label="Loading" />
        </div>
      )}
      {failed && !data && <p className="py-8 text-center text-sm text-gray-400">Couldn't load your record. Try again in a moment.</p>}

      {data && data.totals.games === 0 && (
        <div className="rounded-xl bg-black/40 px-4 py-8 text-center ring-1 ring-white/10">
          <p className="font-display text-lg text-amber-100">Your record starts tonight</p>
          <p className="mt-1 text-sm text-gray-400">Play a game and your wins, best role, and match stories show up here.</p>
        </div>
      )}

      {data && data.totals.games > 0 && (
        <>
          {data.best && (
            <div className="mb-4 flex items-center gap-4 rounded-xl bg-black/40 p-3 ring-1 ring-amber-700/40">
              <img
                src={`/roles/${data.best.role}.webp`}
                alt=""
                className="h-24 w-[72px] shrink-0 rounded-lg object-cover ring-1 ring-amber-600/50"
              />
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Your best role</p>
                <p className="font-display text-xl font-bold text-amber-100">{roleLabel(data.best.role)}</p>
                <p className="text-sm text-gray-300">{data.best.winRate}% wins · {data.best.highlight}</p>
              </div>
            </div>
          )}

          <div className="mb-5 grid grid-cols-4 gap-2">
            <Tile value={data.totals.games} label="games" />
            <Tile value={data.totals.wins} label="wins" />
            <Tile value={`${data.totals.winRate}%`} label="win rate" />
            <Tile value={data.totals.streak} label="streak" />
          </div>

          <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-gray-500">By role</p>
          <div className="mb-5 grid grid-cols-[72px_1fr_64px] items-center gap-x-3 gap-y-2 text-xs">
            {[...data.byRole].sort((a, b) => b.games - a.games).map((r) => (
              <div key={r.role} className="contents">
                <span className="text-gray-300">{roleLabel(r.role)}</span>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full ${data.best?.role === r.role ? "bg-amber-500" : "bg-gray-500"}`}
                    style={{ width: `${r.games ? r.winRate : 0}%` }}
                  />
                </div>
                <span className="text-right tabular-nums text-gray-400">{r.games ? `${r.games} · ${r.winRate}%` : "-"}</span>
              </div>
            ))}
          </div>

          <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-gray-500">Recent matches</p>
          <ul className="mb-5 divide-y divide-white/5">
            {data.recent.map((m, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate text-gray-200">
                  {roleLabel(m.role)} <span className="text-gray-500">· {m.outcome} · {timeAgo(m.endedAt)}</span>
                </span>
                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${
                    m.result === "won" ? "bg-emerald-950/70 text-emerald-300" : m.result === "lost" ? "bg-red-950/70 text-red-300" : "bg-white/10 text-gray-300"
                  }`}
                >
                  {m.result === "won" ? "Won" : m.result === "lost" ? "Lost" : "Draw"}
                </span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => void shareRecord()}
            className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl border border-gray-700 text-gray-200 hover:border-amber-600/50 hover:text-white cursor-pointer transition-colors"
          >
            <Share2 className="h-4 w-4" aria-hidden />
            {shareNote ?? "Share my record"}
          </button>
        </>
      )}

      {import.meta.env.DEV && (
        <button
          type="button"
          onClick={() => void loadDemo()}
          disabled={demoBusy}
          className="mt-4 flex w-full min-h-[40px] items-center justify-center gap-2 rounded-lg border border-dashed border-amber-700/50 text-xs text-amber-200/80 hover:bg-amber-950/30 cursor-pointer"
        >
          {demoBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          Load demo matches (dev only)
        </button>
      )}

      <button
        type="button"
        onClick={onLogout}
        className="mt-4 w-full rounded-lg py-2 text-sm text-gray-500 hover:text-gray-300 cursor-pointer"
      >
        Log out
      </button>
    </div>
  );
}
