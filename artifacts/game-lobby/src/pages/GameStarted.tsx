import type { Player } from "@/App";

type Props = {
  roomCode: string;
  players: Player[];
};

export default function GameStarted({ roomCode, players }: Props) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm text-center">
        <div className="text-6xl mb-6">🎮</div>
        <h1 className="text-3xl font-bold mb-2">Game Started!</h1>
        <p className="text-gray-400 mb-8">Room <span className="font-mono text-white">{roomCode}</span></p>

        <div className="bg-gray-800 border border-gray-700 rounded-2xl px-6 py-5 text-left">
          <p className="text-sm text-gray-400 mb-3 font-medium uppercase tracking-widest">Players</p>
          <div className="flex flex-col gap-3">
            {players.map((player) => (
              <div key={player.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                  {player.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-white text-base font-medium">{player.name}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-gray-500 text-sm mt-8">
          Game logic goes here — add your game to this screen.
        </p>
      </div>
    </div>
  );
}
