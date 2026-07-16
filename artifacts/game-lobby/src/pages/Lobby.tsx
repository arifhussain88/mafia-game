import { useState } from "react";
import type { Player } from "@/App";

const MIN_PLAYERS = 5;

type Props = {
  roomCode: string;
  players: Player[];
  isHost: boolean;
  mySocketId: string;
  onStartGame: () => void;
  onKickPlayer: (targetId: string) => void;
};

export default function Lobby({ roomCode, players, isHost, mySocketId, onStartGame, onKickPlayer }: Props) {
  const [copied, setCopied] = useState(false);
  const [kickConfirm, setKickConfirm] = useState<string | null>(null);

  function handleCopy() {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleKick(targetId: string) {
    if (kickConfirm === targetId) {
      onKickPlayer(targetId);
      setKickConfirm(null);
    } else {
      setKickConfirm(targetId);
      setTimeout(() => setKickConfirm(null), 3000);
    }
  }

  const canStart = isHost && players.length >= MIN_PLAYERS;
  const needed = Math.max(0, MIN_PLAYERS - players.length);

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest mb-3">Room Code</p>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-3 min-h-[64px] px-8 rounded-2xl bg-gray-900 hover:bg-gray-800 border border-gray-700 hover:border-amber-500/40 transition-colors group"
            title="Tap to copy"
          >
            <span className="text-4xl font-bold tracking-widest text-white font-mono">
              {roomCode}
            </span>
            <span className="text-gray-500 group-hover:text-amber-400 transition-colors text-sm">
              {copied ? "✓" : "⎘"}
            </span>
          </button>
          <p className="text-gray-600 text-xs mt-2">Share this code — tap to copy</p>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-widest">Players</h2>
            <span className="text-xs text-gray-600 font-mono">{players.length} joined</span>
          </div>

          <div className="flex flex-col gap-2">
            {players.map((player) => {
              const isMe = player.id === mySocketId;
              const isKickTarget = kickConfirm === player.id;
              return (
                <div
                  key={player.id}
                  className="flex items-center gap-3 min-h-[56px] px-4 rounded-xl bg-gray-900 border border-gray-800"
                >
                  <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-base truncate">
                      {player.name}
                      {isMe && <span className="text-gray-600 text-sm ml-2 font-normal">(you)</span>}
                    </p>
                  </div>
                  {isHost && !isMe && (
                    <button
                      onClick={() => handleKick(player.id)}
                      className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors flex-shrink-0 text-xs font-semibold ${
                        isKickTarget
                          ? "bg-red-700 text-white"
                          : "text-gray-600 hover:text-red-400 hover:bg-red-950/40"
                      }`}
                      title={isKickTarget ? "Tap again to confirm" : "Kick player"}
                    >
                      {isKickTarget ? "Kick?" : "✕"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {isHost ? (
          <div className="flex flex-col gap-3">
            <button
              onClick={onStartGame}
              disabled={!canStart}
              className={`w-full min-h-[56px] rounded-xl text-white text-lg font-semibold transition-colors ${
                canStart
                  ? "bg-amber-600 hover:bg-amber-500 active:bg-amber-700"
                  : "bg-gray-800 cursor-not-allowed text-gray-600 border border-gray-800"
              }`}
            >
              {canStart ? "Start Game" : "Waiting for players…"}
            </button>
            {!canStart && needed > 0 && (
              <p className="text-center text-sm text-gray-600">
                Need {needed} more player{needed !== 1 ? "s" : ""} to start (min {MIN_PLAYERS})
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="inline-flex items-center gap-2 text-gray-500 text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse inline-block" />
              Waiting for the host to start
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
