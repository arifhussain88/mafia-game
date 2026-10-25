import type { Player } from "@/App";

type Props = {
  roomCode: string;
  players: Player[];
};

export default function GameStarted({ roomCode, players }: Props) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm text-center">
        <h1 className="font-display text-3xl font-bold mb-2 text-amber-100 tracking-widest">
          Game Started!
        </h1>
        <p className="text-gray-400 mb-8">
          Room <span className="font-mono text-amber-200">{roomCode}</span>
        </p>

        <div className="game-panel px-6 py-5 text-left">
          <p className="text-xs text-amber-600/90 mb-3 font-semibold uppercase tracking-widest">
            Players
          </p>
          <div className="flex flex-col gap-3">
            {players.map((player) => (
              <div key={player.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-900/60 border border-amber-700/40 flex items-center justify-center text-sm font-bold text-amber-100 flex-shrink-0">
                  {player.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-amber-100 text-base font-medium">{player.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
