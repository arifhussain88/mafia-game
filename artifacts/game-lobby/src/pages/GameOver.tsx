import type { Player } from "@/App";

type Props = {
  winner: "mafia" | "civilians";
  players: Player[];
  mySocketId: string;
};

export default function GameOver({ winner, players, mySocketId }: Props) {
  const mafiaWon = winner === "mafia";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: mafiaWon ? "#100608" : "#081018" }}
    >
      <div className="w-full max-w-sm text-center">
        <div className="text-6xl mb-4">{mafiaWon ? "🔪" : "🏆"}</div>
        <h1
          className={`text-4xl font-bold mb-2 ${mafiaWon ? "text-red-400" : "text-blue-400"}`}
        >
          {mafiaWon ? "Mafia Wins" : "Town Wins"}
        </h1>
        <p className="text-gray-400 mb-8 text-base">
          {mafiaWon
            ? "The Mafia seized control of the town."
            : "The civilians found and eliminated all Mafia."}
        </p>

        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl px-5 py-5 text-left">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-4 font-medium">Final roles revealed</p>
          <div className="flex flex-col gap-2">
            {players
              .sort((a, b) => {
                if (a.role === "mafia" && b.role !== "mafia") return -1;
                if (a.role !== "mafia" && b.role === "mafia") return 1;
                return 0;
              })
              .map((player) => {
                const isMe = player.id === mySocketId;
                const isMafia = player.role === "mafia";
                return (
                  <div
                    key={player.id}
                    className={`flex items-center gap-3 min-h-[48px] px-3 rounded-xl border ${
                      isMafia
                        ? "bg-red-950/30 border-red-900/40"
                        : "bg-gray-800/40 border-gray-700/40"
                    } ${!player.alive ? "opacity-50" : ""}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        isMafia ? "bg-red-700 text-white" : "bg-gray-600 text-white"
                      }`}
                    >
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {player.name}
                        {isMe && <span className="text-gray-500 text-xs ml-1">(you)</span>}
                      </p>
                      {!player.alive && (
                        <p className="text-gray-600 text-xs">eliminated</p>
                      )}
                    </div>
                    <span
                      className={`text-xs font-bold uppercase tracking-wide ${
                        isMafia ? "text-red-400" : "text-blue-400"
                      }`}
                    >
                      {isMafia ? "🔪 Mafia" : "🏘️ Civilian"}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
