import { useState, useEffect } from "react";
import type { Role } from "@/App";
import RoleCard from "@/components/RoleCard";

type Props = {
  role: Role;
  mafiaNames: string[];
  myName: string;
};

const ROLE_META: Record<Role, {
  accentCls: string;
  description: string;
  footnote: (p: { mafiaNames: string[]; myName: string }) => string;
}> = {
  mafia: {
    accentCls: "text-red-400",
    description: "Eliminate the civilians without being caught.",
    footnote: ({ mafiaNames, myName }) => {
      const teammates = mafiaNames.filter((n) => n !== myName);
      if (teammates.length === 0) return "You are the only Mafia member.";
      return `Partner${teammates.length > 1 ? "s" : ""}: ${teammates.join(", ")}`;
    },
  },
  doctor: {
    accentCls: "text-emerald-400",
    description: "Each night, choose one player to protect from the Mafia.",
    footnote: () => "You can protect yourself. Your choice is private.",
  },
  detective: {
    accentCls: "text-amber-400",
    description: "Each night, investigate one player. At dawn, learn if they're Mafia.",
    footnote: () => "Your investigation results are visible only to you.",
  },
  civilian: {
    accentCls: "text-gray-300",
    description: "Find and vote out the Mafia to save the town.",
    footnote: () => "Trust no one. The Mafia is among you.",
  },
};

export default function RoleReveal({ role, mafiaNames, myName }: Props) {
  const [flipped, setFlipped] = useState(false);
  const meta = ROLE_META[role];

  useEffect(() => {
    const t = setTimeout(() => setFlipped(true), 1200);
    return () => clearTimeout(t);
  }, []);

  const footnote = meta.footnote({ mafiaNames, myName });

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: "#0a0a0b" }}
    >
      <p className="text-gray-600 text-xs mb-10 tracking-widest uppercase font-medium">
        Your Role
      </p>

      {/* Illustrated flip card */}
      <RoleCard
        role={role}
        flipped={flipped}
        width={200}
        animate
      />

      {/* Role info — fades in after the flip settles */}
      <div
        style={{
          marginTop: 28,
          width: "100%",
          maxWidth: 300,
          transition: "opacity 0.5s ease 0.4s",
          opacity: flipped ? 1 : 0,
        }}
      >
        <p className={`text-center text-sm leading-relaxed text-gray-400`}>
          {meta.description}
        </p>
        <p
          className={`text-center text-xs mt-3 ${meta.accentCls}`}
          style={{ opacity: 0.8 }}
        >
          {footnote}
        </p>
      </div>

      <p className="mt-10 text-gray-700 text-xs animate-pulse">
        Night begins soon…
      </p>
    </div>
  );
}
