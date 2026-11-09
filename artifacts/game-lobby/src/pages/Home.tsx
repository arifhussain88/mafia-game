import { useState } from "react";
import HowToPlay from "@/components/HowToPlay";
import AuthCard from "@/components/auth/AuthCard";
import { startAmbientLoop, stopAmbientLoop, unlockAudio } from "@/lib/audio";
import { AuthError, clearSession, postAuth, saveSession, type AuthUser } from "@/lib/auth-api";
import { requestAppExit, useBackHandler } from "@/lib/native-bridge";
import { takeInviteCode } from "@/lib/invite";
import { ProfileScreen, ProfileStrip, useProfile } from "@/components/profile/Profile";

type Props = {
  onCreateRoom: (name: string) => void;
  onJoinRoom: (code: string, name: string) => void;
  onAuthenticated: () => void;
  onLogout?: () => void;
};

type View = "main" | "create" | "join" | "profile";

const inputCls =
  "w-full min-h-[52px] px-4 rounded-xl bg-black/55 ring-1 ring-white/12 text-white placeholder-gray-600 text-base focus:outline-none focus:ring-2 focus:ring-amber-500/70 transition-shadow";

const primaryBtn =
  "w-full min-h-[52px] rounded-xl bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-lg font-semibold transition-colors shadow-[0_8px_24px_-8px_rgba(217,119,6,0.6)]";

const ghostBtn =
  "w-full min-h-[52px] rounded-xl bg-transparent border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 text-base transition-colors";

const secondaryBtn =
  "w-full min-h-[52px] rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-700 text-white text-lg font-semibold transition-colors";

const ROLES = ["mafia", "detective", "doctor", "civilian"] as const;

function readUser(): AuthUser | null {
  try { return JSON.parse(localStorage.getItem("mafia-user") || "null"); } catch { return null; }
}

function readToken(): string | null {
  try { return localStorage.getItem("mafia-token"); } catch { return null; }
}

export default function Home({ onCreateRoom, onJoinRoom, onAuthenticated, onLogout }: Props) {
  const [user, setUser] = useState<AuthUser | null>(readUser);
  // Opened from an invite link (/join/ABCDE): go straight to Join with the code filled in.
  const [inviteCode] = useState(takeInviteCode);
  const [view, setView] = useState<View>(() => (readUser() && inviteCode ? "join" : "main"));
  // Default the per-room name to the account name; players can still change it.
  const [name, setName] = useState(() => readUser()?.name ?? "");
  const [code, setCode] = useState(inviteCode ?? "");
  const [error, setError] = useState("");
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePass, setDeletePass] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  // Refetch stats each time you come back to the main screen (e.g. after a match).
  const profile = useProfile(user ? readToken() : null, `${user?.id}:${view === "main" || view === "profile"}`);

  // Android back: close the innermost open panel; on the root screen, exit the app.
  useBackHandler(() => {
    setError("");
    if (howToPlayOpen) setHowToPlayOpen(false);
    else if (deleteOpen) { setDeleteOpen(false); setDeletePass(""); }
    else if (view !== "main") { setView("main"); setCode(""); }
    else requestAppExit();
  });

  function signedIn(next: AuthUser) {
    setUser(next);
    setName(next.name);
    setError("");
    if (inviteCode) {
      setCode(inviteCode);
      setView("join");
    }
    onAuthenticated();
  }

  function goTo(next: View) {
    setView(next);
    setError("");
    if (!name.trim() && user) setName(user.name);
  }

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) { setError("Enter your display name"); return; }
    onCreateRoom(trimmed);
  }

  function handleJoin() {
    const trimmedName = name.trim();
    const trimmedCode = code.trim().toUpperCase();
    if (trimmedCode.length !== 5) { setError("Room code must be 5 characters"); return; }
    if (!trimmedName) { setError("Enter your display name"); return; }
    onJoinRoom(trimmedCode, trimmedName);
  }

  async function handleDeleteAccount() {
    setError("");
    if (!deletePass) { setError("Enter your password to confirm"); return; }
    const token = readToken();
    if (!token) { setError("Please sign in again"); return; }
    setDeleteBusy(true);
    try {
      await postAuth("delete-account", { password: deletePass }, token);
      clearSession();
      setDeleteOpen(false);
      setDeletePass("");
      setUser(null);
      setName("");
      onLogout?.();
    } catch (e) {
      setError((e as AuthError).message);
    } finally {
      setDeleteBusy(false);
    }
  }

  async function handleLogout() {
    const token = readToken();
    if (token) {
      try { await postAuth("logout", {}, token); } catch { /* ignore network errors on logout */ }
    }
    clearSession();
    setUser(null);
    setName("");
    setView("main");
    onLogout?.();
  }

  async function handleTestLogin(email: string) {
    if (!import.meta.env.DEV) return;
    unlockAudio();
    setError("");
    startAmbientLoop();
    try {
      const data = await postAuth<{ token: string; user: AuthUser }>("login", { email, password: "testdev123" });
      saveSession(data.token, data.user);
      signedIn(data.user);
    } catch (e) {
      stopAmbientLoop();
      setError((e as AuthError).message);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        {view === "main" && !deleteOpen && (
          <div className="game-panel bg-black/50! ring-1 ring-white/10 shadow-2xl shadow-black/50 px-5 pt-6 pb-5">
            <header className="text-center mb-5">
              <h1 className="font-display text-5xl font-bold tracking-tight mb-2 drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]">
                <span className="bg-gradient-to-b from-amber-200 to-amber-600 bg-clip-text text-transparent">
                  Mafia
                </span>
              </h1>
              <p className="text-amber-200/70 text-xs uppercase tracking-[0.22em]">Town has a problem</p>
            </header>

            {user ? (
              <>
                <ProfileStrip name={user.name} data={profile.data} onOpen={() => goTo("profile")} />
                <div className="flex flex-col gap-3">
                  <button type="button" onClick={() => goTo("create")} className={`${primaryBtn} cursor-pointer`}>
                    Create Room
                  </button>
                  <button type="button" onClick={() => goTo("join")} className={`${secondaryBtn} cursor-pointer`}>
                    Join Room
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-5 flex justify-center -space-x-3" aria-hidden>
                  {ROLES.map((role, i) => (
                    <img
                      key={role}
                      src={`/roles/${role}.webp`}
                      alt=""
                      loading="lazy"
                      className="h-16 w-12 rounded-lg object-cover ring-2 ring-black/80 shadow-lg shadow-black/60"
                      style={{ transform: `rotate(${(i - 1.5) * 7}deg) translateY(${Math.abs(i - 1.5) * 3}px)` }}
                    />
                  ))}
                </div>
                {inviteCode && (
                  <p className="mb-4 rounded-xl bg-amber-950/40 px-4 py-3 text-center text-sm text-amber-100 ring-1 ring-amber-700/40">
                    You're invited to room <span className="font-mono font-bold tracking-widest">{inviteCode}</span>. Sign in or create an account to join.
                  </p>
                )}
                <AuthCard
                  onAuthenticated={signedIn}
                  onBeforeSubmit={() => { unlockAudio(); startAmbientLoop(); }}
                  onFailed={stopAmbientLoop}
                />
                {import.meta.env.DEV && (
                  <div className="mt-5 border-t border-white/10 pt-4">
                    <p className="mb-2 text-center text-[11px] uppercase tracking-[0.18em] text-gray-500">Dev quick login</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        ["Mafia", "mafia@test.local"],
                        ["Doctor", "doctor@test.local"],
                        ["Detective", "detective@test.local"],
                        ["Civilian", "civilian@test.local"],
                      ].map(([label, email]) => (
                        <button
                          key={email}
                          type="button"
                          onClick={() => handleTestLogin(email)}
                          className="min-h-[36px] rounded-lg border border-amber-900/60 text-amber-200 text-xs cursor-pointer hover:bg-amber-950/40 transition-colors"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {error && <p className="mt-2 text-center text-red-400 text-sm">{error}</p>}
                  </div>
                )}
              </>
            )}

            <button
              type="button"
              onClick={() => setHowToPlayOpen(true)}
              className={`${ghostBtn} mt-3 cursor-pointer`}
            >
              How to play
            </button>
          </div>
        )}

        {view === "profile" && user && !deleteOpen && (
          <ProfileScreen
            name={user.name}
            data={profile.data}
            failed={profile.failed}
            onBack={() => goTo("main")}
            onLogout={() => void handleLogout()}
          />
        )}

        {deleteOpen && user && (
          <div className="game-panel px-5 py-6">
            <h3 className="font-display text-xl font-semibold text-white mb-2">Delete account</h3>
            <p className="text-sm text-gray-400 mb-3">
              This permanently deletes your account, profile, stats and chat messages. It cannot be undone.
            </p>
            <form onSubmit={(e) => { e.preventDefault(); void handleDeleteAccount(); }}>
              <input
                className={inputCls + " mb-2"}
                placeholder="Confirm your password"
                type="password"
                autoComplete="current-password"
                value={deletePass}
                onChange={(e) => { setDeletePass(e.target.value); setError(""); }}
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex gap-2 mt-3">
                <button
                  type="submit"
                  disabled={deleteBusy}
                  className="w-full min-h-[52px] rounded-xl bg-red-700 hover:bg-red-600 disabled:opacity-60 text-white text-base font-semibold transition-colors cursor-pointer"
                >
                  {deleteBusy ? "Deleting…" : "Delete forever"}
                </button>
                <button
                  type="button"
                  className={`${ghostBtn} cursor-pointer`}
                  onClick={() => { setDeleteOpen(false); setDeletePass(""); setError(""); }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {view === "create" && (
          <div className="game-panel px-5 py-6">
            <div className="mb-6">
              <h2 className="font-display text-2xl font-bold text-white mb-1">Create a room</h2>
              <p className="text-gray-500 text-sm">You'll be the host.</p>
            </div>
            <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); handleCreate(); }}>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-gray-400">Your display name</span>
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(""); }}
                  placeholder="e.g. Ghost"
                  maxLength={24}
                  autoComplete="nickname"
                  className={inputCls}
                />
              </label>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button type="submit" className={`${primaryBtn} cursor-pointer`}>Create Room</button>
              <button type="button" onClick={() => goTo("main")} className={`${ghostBtn} cursor-pointer`}>Back</button>
            </form>
          </div>
        )}

        {view === "join" && (
          <div className="game-panel px-5 py-6">
            <div className="mb-6">
              <h2 className="font-display text-2xl font-bold text-white mb-1">Join a room</h2>
              <p className="text-gray-500 text-sm">Enter the 5-letter code from the host.</p>
            </div>
            <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); handleJoin(); }}>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-gray-400">Room code</span>
                <input
                  autoFocus
                  type="text"
                  value={code}
                  onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(""); }}
                  placeholder="e.g. AB3X7"
                  maxLength={5}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  className={`${inputCls} tracking-widest uppercase text-center text-xl font-bold`}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-gray-400">Your display name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(""); }}
                  placeholder="e.g. Ghost"
                  maxLength={24}
                  autoComplete="nickname"
                  className={inputCls}
                />
              </label>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button type="submit" className={`${primaryBtn} cursor-pointer`}>Join Room</button>
              <button type="button" onClick={() => { goTo("main"); setCode(""); }} className={`${ghostBtn} cursor-pointer`}>Back</button>
            </form>
          </div>
        )}

        <p className="text-center text-xs text-gray-500 mt-8">
          <a href="/privacy.html" target="_blank" rel="noreferrer" className="underline">Privacy Policy</a>
          {" · "}
          <a href="/terms.html" target="_blank" rel="noreferrer" className="underline">Terms of Service</a>
          {user && !deleteOpen && view === "main" && (
            <>
              {" · "}
              <button
                type="button"
                className="underline cursor-pointer"
                onClick={() => { setDeleteOpen(true); setError(""); }}
              >
                Delete account
              </button>
            </>
          )}
        </p>
      </div>
      <HowToPlay open={howToPlayOpen} onOpenChange={setHowToPlayOpen} />
    </div>
  );
}
