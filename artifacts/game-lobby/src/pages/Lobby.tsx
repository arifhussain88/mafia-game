import { useState } from "react";
import type { Player } from "@/App";

type Props = {
  roomCode: string;
  players: Player[];
  isHost: boolean;
  mySocketId: string;
  onStartGame: () => void;
};

export default function Lobby({ roomCode, players, isHost, mySocketId, onStartGame }: Props) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const canStart = isHost && players.length >= 4;
  const needed = Math.max(0, 4 - players.length);

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <p className="text-sm font-medium text-gray-400 uppercase tracking-widest mb-2">Room Code</p>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-2 min-h-[52px] px-6 rounded-2xl bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
            title="Tap to copy"
          >
            <span className="text-4xl font-bold tracking-widest text-white font-mono">
              {roomCode}
            </span>
            <span className="text-gray-400 text-sm ml-1">
              {copied ? "✓" : "⎘"}
            </span>
          </button>
          <p className="text-gray-500 text-xs mt-2">Share this code with others to join</p>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-300">
              Players
            </h2>
            <span className="text-sm text-gray-500 font-mono">
              {players.length}/∞
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {players.map((player) => {
              const isMe = player.id === mySocketId;
              return (
                <div
                  key={player.id}
                  className="flex items-center justify-between min-h-[52px] px-4 rounded-xl bg-gray-800 border border-gray-700"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-white font-medium text-base">
                      {player.name}
                      {isMe && (
                        <span className="text-gray-500 text-sm ml-2 font-normal">(you)</span>
                      )}
                    </span>
                  </div>
                  {player.isHost && (
                    <span className="text-xs font-semibold text-amber-400 bg-amber-400/10 px-2 py-1 rounded-full border border-amber-400/20">
                      HOST
                    </span>
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
                  ? "bg-green-600 hover:bg-green-500 active:bg-green-700"
                  : "bg-gray-700 cursor-not-allowed text-gray-400"
              }`}
            >
              {canStart ? "Start Game" : `Waiting for players…`}
            </button>
            {!canStart && needed > 0 && (
              <p className="text-center text-sm text-gray-500">
                Need {needed} more player{needed !== 1 ? "s" : ""} to start
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="inline-flex items-center gap-2 text-gray-400 text-base">
              <span className="animate-pulse">●</span>
              Waiting for the host to start the game
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
