import { useState } from "react";

type Props = {
  onCreateRoom: (name: string) => void;
  onJoinRoom: (code: string, name: string) => void;
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

export default function Home({ onCreateRoom, onJoinRoom }: Props) {
  const [view, setView] = useState<View>("main");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {view === "main" && (
          <>
            <div className="text-center mb-10">
              <div className="text-5xl mb-4">🔪</div>
              <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Mafia</h1>
              <p className="text-gray-500 text-base">The town has a problem.</p>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={() => { setView("create"); setError(""); }} className={primaryBtn}>
                Create Room
              </button>
              <button onClick={() => { setView("join"); setError(""); }} className={secondaryBtn}>
                Join Room
              </button>
            </div>
          </>
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
