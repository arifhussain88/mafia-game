import { useState } from "react";
import type { Player } from "@/App";
import HowToPlay from "@/components/HowToPlay";

const MIN_PLAYERS = 3;

export type TimerSettings = {
  nightStepSec: number;
  dayDiscussionSec: number;
  dayVoteSec: number;
};

export const DEFAULT_TIMER_SETTINGS: TimerSettings = {
  nightStepSec: 60,
  dayDiscussionSec: 60,
  dayVoteSec: 30,
};

const TIMER_BOUNDS = {
  nightStepSec: { min: 15, max: 90, step: 5, label: "Night turn" },
  dayDiscussionSec: { min: 30, max: 180, step: 15, label: "Day discussion" },
  dayVoteSec: { min: 15, max: 90, step: 5, label: "Day vote" },
} as const;

type TimerKey = keyof TimerSettings;

type Props = {
  roomCode: string;
  players: Player[];
  isHost: boolean;
  mySocketId: string;
  timerSettings: TimerSettings;
  onStartGame: () => void;
  onKickPlayer: (targetId: string) => void;
  onTimerSettingsChange: (next: TimerSettings) => void;
};

function TimerRow({
  label,
  value,
  min,
  max,
  step,
  editable,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  editable: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 min-h-[44px]">
      <span className="text-sm text-gray-400">{label}</span>
      {editable ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={value <= min}
            onClick={() => onChange(Math.max(min, value - step))}
            className="w-9 h-9 rounded-lg border border-gray-700 text-amber-200 hover:bg-amber-950/40 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            aria-label={`Decrease ${label}`}
          >
            −
          </button>
          <span className="w-14 text-center font-mono text-amber-100 tabular-nums">{value}s</span>
          <button
            type="button"
            disabled={value >= max}
            onClick={() => onChange(Math.min(max, value + step))}
            className="w-9 h-9 rounded-lg border border-gray-700 text-amber-200 hover:bg-amber-950/40 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            aria-label={`Increase ${label}`}
          >
            +
          </button>
        </div>
      ) : (
        <span className="font-mono text-sm text-gray-300 tabular-nums">{value}s</span>
      )}
    </div>
  );
}

export default function Lobby({
  roomCode,
  players,
  isHost,
  mySocketId,
  timerSettings,
  onStartGame,
  onKickPlayer,
  onTimerSettingsChange,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [kickConfirm, setKickConfirm] = useState<string | null>(null);
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);

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

  function bump(key: TimerKey, value: number) {
    onTimerSettingsChange({ ...timerSettings, [key]: value });
  }

  const canStart = isHost && players.length >= MIN_PLAYERS;
  const needed = Math.max(0, MIN_PLAYERS - players.length);

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-10">
      <div className="game-panel w-full max-w-sm px-5 py-6">

        <div className="text-center mb-8">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Room Code</p>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-3 min-h-[64px] px-8 rounded-2xl bg-gray-900/80 hover:bg-gray-800 border border-gray-700 hover:border-amber-500/40 transition-colors group cursor-pointer"
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

        <div className="mb-6 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-widest">Phase timers</h2>
            {!isHost && (
              <span className="text-[10px] uppercase tracking-wider text-gray-600">Host sets these</span>
            )}
          </div>
          <div className="flex flex-col gap-1">
            {(Object.keys(TIMER_BOUNDS) as TimerKey[]).map((key) => {
              const bound = TIMER_BOUNDS[key];
              return (
                <TimerRow
                  key={key}
                  label={bound.label}
                  value={timerSettings[key]}
                  min={bound.min}
                  max={bound.max}
                  step={bound.step}
                  editable={isHost}
                  onChange={(v) => bump(key, v)}
                />
              );
            })}
          </div>
        </div>

        {isHost ? (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={onStartGame}
              disabled={!canStart}
              className={`w-full min-h-[56px] rounded-xl text-white text-lg font-semibold transition-colors ${
                canStart
                  ? "bg-amber-600 hover:bg-amber-500 active:bg-amber-700 cursor-pointer"
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

        <button
          type="button"
          onClick={() => setHowToPlayOpen(true)}
          className="w-full min-h-[52px] mt-4 rounded-xl bg-transparent border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 text-base transition-colors cursor-pointer"
        >
          How to play
        </button>
      </div>
      <HowToPlay open={howToPlayOpen} onOpenChange={setHowToPlayOpen} />
    </div>
  );
}
