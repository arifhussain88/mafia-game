import { useState } from "react";
import { startAmbientLoop, stopAmbientLoop, unlockAudio } from "@/lib/audio";

type Props = {
  onCreateRoom: (name: string) => void;
  onJoinRoom: (code: string, name: string) => void;
  onAuthenticated: () => void;
};

type View = "main" | "create" | "join";

const inputCls =
  "w-full min-h-[52px] px-4 rounded-xl bg-gray-900 border border-gray-700 text-white placeholder-gray-600 text-base focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/40 transition-colors";

const primaryBtn =
  "w-full min-h-[52px] rounded-xl bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-lg font-semibold transition-colors";

const ghostBtn =
  "w-full min-h-[52px] rounded-xl bg-transparent border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 text-base transition-colors";

const secondaryBtn =
  "w-full min-h-[52px] rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-700 text-white text-lg font-semibold transition-colors";

export default function Home({ onCreateRoom, onJoinRoom, onAuthenticated }: Props) {
  const [view, setView] = useState<View>("main");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [authMode, setAuthMode] = useState<"idle" | "signup" | "login">("idle");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authDob, setAuthDob] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [user, setUser] = useState<{ id: string; name: string } | null>(() => {
    try { return JSON.parse(localStorage.getItem("mafia-user") || "null"); } catch { return null; }
  });

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) { setError("Enter your display name"); return; }
    onCreateRoom(trimmed);
  }

  function handleJoin() {
    const trimmedName = name.trim();
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedName) { setError("Enter your display name"); return; }
    if (trimmedCode.length !== 5) { setError("Room code must be 5 characters"); return; }
    onJoinRoom(trimmedCode, trimmedName);
  }

  async function handleSignup() {
    unlockAudio();
    setError("");
    if (!authName.trim() || !authPass || !authEmail.trim() || !authDob.trim()) { setError("Enter name, email, dob and password"); return; }
    if (!acceptTerms) { setError("You must accept the terms to sign up"); return; }
    // basic email check
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(authEmail)) { setError("Enter a valid email"); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(authDob)) { setError("Enter DOB as YYYY-MM-DD"); return; }
    if (authPass.length < 8) { setError("Password must be at least 8 characters"); return; }
    startAmbientLoop();
    try {
      const res = await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: authName.trim(), email: authEmail.trim(), password: authPass, dob: authDob.trim() }) });
      if (!res.ok) {
        let errMsg = "Signup failed";
        try {
          const body = await res.json();
          errMsg = body?.message || JSON.stringify(body) || errMsg;
        } catch {
          try { const text = await res.text(); if (text) errMsg = text; } catch {}
        }
        throw new Error(errMsg);
      }
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        const text = await res.text();
        throw new Error(text || "Invalid server response");
      }
      localStorage.setItem("mafia-token", data.token);
      localStorage.setItem("mafia-user", JSON.stringify(data.user));
      setUser(data.user);
      setAuthMode("idle");
      onAuthenticated();
    } catch (e: any) {
      stopAmbientLoop();
      setError(e?.message || String(e));
    }
  }

  async function handleLogin() {
    unlockAudio();
    setError("");
    if (!authEmail.trim() || !authPass) { setError("Enter email and password"); return; }
    startAmbientLoop();
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: authEmail.trim(), password: authPass }) });
      if (!res.ok) {
        let errMsg = "Login failed";
        try {
          const body = await res.json();
          errMsg = body?.message || JSON.stringify(body) || errMsg;
        } catch {
          try { const text = await res.text(); if (text) errMsg = text; } catch {}
        }
        throw new Error(errMsg);
      }
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        const text = await res.text();
        throw new Error(text || "Invalid server response");
      }
      localStorage.setItem("mafia-token", data.token);
      localStorage.setItem("mafia-user", JSON.stringify(data.user));
      setUser(data.user);
      setAuthMode("idle");
      onAuthenticated();
    } catch (e: any) {
      stopAmbientLoop();
      setError(e?.message || String(e));
    }
  }

  function handleLogout() {
    localStorage.removeItem("mafia-token");
    localStorage.removeItem("mafia-user");
    setUser(null);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {view === "main" && (
          <>
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">🔪</div>
              <h1 className="text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-rose-300 mb-2">Mafia Wars</h1>
              <p className="text-red-200 text-sm italic mb-4">The Town has a problem</p>

              {user ? (
                <div className="text-sm text-gray-300">Signed in as <strong className="text-white">{user.name}</strong> <button className="ml-3 text-xs underline" onClick={handleLogout}>Log out</button></div>
              ) : (
                <div className="flex gap-2 justify-center mt-3">
                  <button onClick={() => { setAuthMode("signup"); setError(""); }} className="px-3 py-2 bg-transparent border border-gray-700 rounded text-sm text-gray-200">Sign up</button>
                  <button onClick={() => { setAuthMode("login"); setError(""); }} className="px-3 py-2 bg-transparent border border-gray-700 rounded text-sm text-gray-200">Log in</button>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3">
              {user ? (
                <>
                  <button onClick={() => { setView("create"); setError(""); }} className={primaryBtn}>
                    Create Room
                  </button>
                  <button onClick={() => { setView("join"); setError(""); }} className={secondaryBtn}>
                    Join Room
                  </button>
                </>
              ) : (
                <div className="text-sm text-gray-400 text-center">Please sign up or log in to create or join rooms.</div>
              )}
            </div>
          </>
        )}

        {authMode === "signup" && !user && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-white mb-2">Sign up</h3>
            <input className={inputCls + " mb-2"} placeholder="Display name" value={authName} onChange={(e) => setAuthName(e.target.value)} />
            <input className={inputCls + " mb-2"} placeholder="Email address" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} />
            <input className={inputCls + " mb-2"} placeholder="Date of birth (YYYY-MM-DD)" value={authDob} onChange={(e) => setAuthDob(e.target.value)} />
            <input className={inputCls + " mb-2"} placeholder="Password (min 8 chars)" type="password" value={authPass} onChange={(e) => setAuthPass(e.target.value)} />
            <label className="flex items-center gap-2 text-sm text-gray-300 mb-2">
              <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
              <span>I accept the <a href="/terms.html" target="_blank" rel="noreferrer" className="underline">Terms of Service</a></span>
            </label>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-2 mt-3">
              <button className={primaryBtn} onClick={handleSignup}>Create account</button>
              <button className={ghostBtn} onClick={() => setAuthMode("idle")}>Cancel</button>
            </div>
          </div>
        )}

        {authMode === "login" && !user && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-white mb-2">Log in</h3>
            <input className={inputCls + " mb-2"} placeholder="Email address" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} />
            <input className={inputCls + " mb-2"} placeholder="Password" type="password" value={authPass} onChange={(e) => setAuthPass(e.target.value)} />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-2 mt-3">
              <button className={primaryBtn} onClick={handleLogin}>Log in</button>
              <button className={ghostBtn} onClick={() => setAuthMode("idle")}>Cancel</button>
            </div>
          </div>
        )}

        {view === "create" && (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-1">Create a room</h2>
              <p className="text-gray-500 text-sm">You'll be the host.</p>
            </div>
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-gray-400">Your display name</span>
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="e.g. Ghost"
                  maxLength={24}
                  className={inputCls}
                />
              </label>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button onClick={handleCreate} className={primaryBtn}>Create Room</button>
              <button onClick={() => { setView("main"); setError(""); setName(""); }} className={ghostBtn}>Back</button>
            </div>
          </>
        )}

        {view === "join" && (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-1">Join a room</h2>
              <p className="text-gray-500 text-sm">Enter the 5-letter code from the host.</p>
            </div>
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-gray-400">Room code</span>
                <input
                  autoFocus
                  type="text"
                  value={code}
                  onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(""); }}
                  placeholder="e.g. AB3X7"
                  maxLength={5}
                  className={`${inputCls} tracking-widest uppercase text-center text-xl font-bold`}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-gray-400">Your display name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  placeholder="e.g. Ghost"
                  maxLength={24}
                  className={inputCls}
                />
              </label>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button onClick={handleJoin} className={primaryBtn}>Join Room</button>
              <button onClick={() => { setView("main"); setError(""); setName(""); setCode(""); }} className={ghostBtn}>Back</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
