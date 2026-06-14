import { useState } from "react";

type Props = {
  onCreateRoom: (name: string) => void;
  onJoinRoom: (code: string, name: string) => void;
};

type View = "main" | "create" | "join";

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
        <h1 className="text-4xl font-bold tracking-tight text-center mb-2">
          Game Lobby
        </h1>
        <p className="text-gray-400 text-center mb-10 text-lg">
          Create or join a room to play
        </p>

        {view === "main" && (
          <div className="flex flex-col gap-4">
            <button
              onClick={() => { setView("create"); setError(""); }}
              className="w-full min-h-[52px] rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-lg font-semibold transition-colors"
            >
              Create Room
            </button>
            <button
              onClick={() => { setView("join"); setError(""); }}
              className="w-full min-h-[52px] rounded-xl bg-gray-800 hover:bg-gray-700 active:bg-gray-900 text-white text-lg font-semibold border border-gray-700 transition-colors"
            >
              Join Room
            </button>
          </div>
        )}

        {view === "create" && (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-gray-300">Your display name</span>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="e.g. Lightning"
                maxLength={24}
                className="w-full min-h-[52px] px-4 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={handleCreate}
              className="w-full min-h-[52px] rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-lg font-semibold transition-colors"
            >
              Create Room
            </button>
            <button
              onClick={() => { setView("main"); setError(""); setName(""); }}
              className="w-full min-h-[52px] rounded-xl bg-transparent border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 text-base transition-colors"
            >
              Back
            </button>
          </div>
        )}

        {view === "join" && (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-gray-300">Room code</span>
              <input
                autoFocus
                type="text"
                value={code}
                onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(""); }}
                placeholder="e.g. AB3X7"
                maxLength={5}
                className="w-full min-h-[52px] px-4 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 text-base tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-gray-300">Your display name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                placeholder="e.g. Lightning"
                maxLength={24}
                className="w-full min-h-[52px] px-4 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={handleJoin}
              className="w-full min-h-[52px] rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-lg font-semibold transition-colors"
            >
              Join Room
            </button>
            <button
              onClick={() => { setView("main"); setError(""); setName(""); setCode(""); }}
              className="w-full min-h-[52px] rounded-xl bg-transparent border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 text-base transition-colors"
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
