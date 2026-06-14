import type { Player } from "@/App";

type Props = {
  winner: "mafia" | "civilians";
  players: Player[];
  mySocketId: string;
  isHost: boolean;
  onPlayAgain: () => void;
};

export default function GameOver({ winner, players, mySocketId, isHost, onPlayAgain }: Props) {
  const mafiaWon = winner === "mafia";

  const mafia = players.filter((p) => p.role === "mafia");
  const civilians = players.filter((p) => p.role === "civilian");

  return (
    <div
      className="min-h-screen flex flex-col items-center px-4 py-10"
      style={{ background: "#0a0a0b" }}
    >
      <div className="w-full max-w-sm">

        {/* Result banner */}
        <div
          className={`rounded-2xl border px-6 py-8 text-center mb-6 ${
            mafiaWon
              ? "bg-red-950/30 border-red-900/50 shadow-[0_0_48px_rgba(127,29,29,0.15)]"
              : "bg-amber-950/20 border-amber-900/30 shadow-[0_0_48px_rgba(120,53,15,0.1)]"
          }`}
        >
          <div className="text-5xl mb-3">{mafiaWon ? "🔪" : "🏆"}</div>
          <h1 className={`text-4xl font-bold mb-2 ${mafiaWon ? "text-red-400" : "text-amber-400"}`}>
            {mafiaWon ? "Mafia Wins" : "Town Wins"}
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            {mafiaWon
              ? "The Mafia seized control of the town."
              : "The civilians uncovered and eliminated all Mafia."}
          </p>
        </div>

        {/* Mafia section */}
        {mafia.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-red-600 uppercase tracking-widest font-semibold mb-2 px-1">Mafia</p>
            <div className="flex flex-col gap-2">
              {mafia.map((player) => {
                const isMe = player.id === mySocketId;
                return (
                  <div
                    key={player.id}
                    className="flex items-center gap-3 min-h-[52px] px-4 rounded-xl bg-red-950/25 border border-red-900/40"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${player.alive ? "bg-red-700 text-white" : "bg-red-950 text-red-700"}`}>
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${player.alive ? "text-white" : "text-gray-600 line-through"}`}>
                        {player.name}
                        {isMe && <span className="text-gray-600 text-xs ml-1">(you)</span>}
                      </p>
                      {!player.alive && <p className="text-xs text-gray-700">eliminated</p>}
                    </div>
                    <span className="text-xs text-red-500 font-bold">🔪</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Civilians section */}
        {civilians.length > 0 && (
          <div className="mb-6">
            <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold mb-2 px-1">Civilians</p>
            <div className="flex flex-col gap-2">
              {civilians.map((player) => {
                const isMe = player.id === mySocketId;
                return (
                  <div
                    key={player.id}
                    className="flex items-center gap-3 min-h-[52px] px-4 rounded-xl bg-gray-900/60 border border-gray-800"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${player.alive ? "bg-gray-600 text-white" : "bg-gray-800 text-gray-600"}`}>
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${player.alive ? "text-white" : "text-gray-600 line-through"}`}>
                        {player.name}
                        {isMe && <span className="text-gray-600 text-xs ml-1">(you)</span>}
                      </p>
                      {!player.alive && <p className="text-xs text-gray-700">eliminated</p>}
                    </div>
                    <span className="text-xs text-amber-700 font-bold">🏘️</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Play Again (host only) */}
        {isHost ? (
          <button
            onClick={onPlayAgain}
            className="w-full min-h-[56px] rounded-xl bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-lg font-semibold transition-colors"
          >
            Play Again
          </button>
        ) : (
          <div className="text-center py-2">
            <div className="inline-flex items-center gap-2 text-gray-600 text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse inline-block" />
              Waiting for host to start a new game
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
