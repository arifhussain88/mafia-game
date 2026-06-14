import { useState, useEffect } from "react";
import type { Role } from "@/App";
import MafiaIcon from "@/components/icons/MafiaIcon";
import DoctorIcon from "@/components/icons/DoctorIcon";
import DetectiveIcon from "@/components/icons/DetectiveIcon";
import CivilianIcon from "@/components/icons/CivilianIcon";

type Props = {
  role: Role;
  mafiaNames: string[];
  myName: string;
};

const ROLE_DATA: Record<Role, {
  card: string;
  nameColor: string;
  label: string;
  description: string;
  footnote: (params: { mafiaNames: string[]; myName: string }) => string;
}> = {
  mafia: {
    card: "bg-red-950 border-red-900 shadow-[0_0_48px_rgba(185,28,28,0.25)]",
    nameColor: "text-red-400",
    label: "MAFIA",
    description: "Eliminate the civilians without being caught.",
    footnote: ({ mafiaNames, myName }) => {
      const teammates = mafiaNames.filter((n) => n !== myName);
      if (teammates.length === 0) return "You are the only Mafia member.";
      return `Partner${teammates.length > 1 ? "s" : ""}: ${teammates.join(", ")}`;
    },
  },
  doctor: {
    card: "bg-emerald-950 border-emerald-900 shadow-[0_0_40px_rgba(6,78,59,0.3)]",
    nameColor: "text-emerald-400",
    label: "DOCTOR",
    description: "Each night, choose one player to protect from the Mafia.",
    footnote: () => "You can protect yourself. Your choice is private.",
  },
  detective: {
    card: "bg-amber-950 border-amber-900 shadow-[0_0_40px_rgba(120,53,15,0.3)]",
    nameColor: "text-amber-400",
    label: "DETECTIVE",
    description: "Each night, investigate one player. At dawn, learn if they're Mafia.",
    footnote: () => "Your investigation results are visible only to you.",
  },
  civilian: {
    card: "bg-gray-900 border-gray-700 shadow-[0_0_32px_rgba(0,0,0,0.5)]",
    nameColor: "text-gray-100",
    label: "CIVILIAN",
    description: "Find and vote out the Mafia to save the town.",
    footnote: () => "Trust no one. The Mafia is among you.",
  },
};

function RoleIcon({ role }: { role: Role }) {
  switch (role) {
    case "mafia":     return <MafiaIcon size={72} />;
    case "doctor":    return <DoctorIcon size={72} />;
    case "detective": return <DetectiveIcon size={72} />;
    case "civilian":  return <CivilianIcon size={72} />;
  }
}

export default function RoleReveal({ role, mafiaNames, myName }: Props) {
  const [flipped, setFlipped] = useState(false);
  const data = ROLE_DATA[role];

  useEffect(() => {
    const t = setTimeout(() => setFlipped(true), 1200);
    return () => clearTimeout(t);
  }, []);

  const footnote = data.footnote({ mafiaNames, myName });

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: "#0a0a0b" }}
    >
      <p className="text-gray-600 text-sm mb-10 tracking-widest uppercase font-medium">
        Your role
      </p>

      <div style={{ perspective: "900px" }} className="w-64 h-80">
        <div
          style={{
            transformStyle: "preserve-3d",
            transition: "transform 0.85s cubic-bezier(0.4,0,0.2,1)",
            transform: flipped ? "rotateY(0deg)" : "rotateY(180deg)",
            position: "relative",
            width: "100%",
            height: "100%",
          }}
        >
          {/* Front — role card */}
          <div
            style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
            className={`absolute inset-0 rounded-2xl flex flex-col items-center justify-center gap-4 p-6 border ${data.card}`}
          >
            <RoleIcon role={role} />
            <div className={`text-2xl font-bold tracking-widest ${data.nameColor}`}>
              {data.label}
            </div>
            <p className="text-center text-sm leading-relaxed text-gray-400 px-2">
              {data.description}
            </p>
          </div>

          {/* Back — face-down card */}
          <div
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
            className="absolute inset-0 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center"
          >
            <span className="text-7xl opacity-10 select-none font-bold text-white">?</span>
          </div>
        </div>
      </div>

      {flipped && (
        <div className="mt-8 w-full max-w-xs text-center">
          <p className={`text-sm ${
            role === "mafia" ? "text-red-500/80" :
            role === "doctor" ? "text-emerald-600" :
            role === "detective" ? "text-amber-600" :
            "text-gray-600"
          }`}>
            {footnote}
          </p>
        </div>
      )}

      <p className="mt-10 text-gray-700 text-xs animate-pulse">Night begins soon…</p>
    </div>
  );
}
