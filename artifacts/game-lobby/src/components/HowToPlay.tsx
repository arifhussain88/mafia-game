import type { Role } from "@/App";
import RoleCard from "@/components/RoleCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const ROLES: {
  role: Role;
  label: string;
  can: string;
  cannot: string;
}[] = [
  {
    role: "mafia",
    label: "Mafia",
    can: "At night, pick someone to attack. Work with other Mafia when the game lets you.",
    cannot: "Cannot heal or investigate.",
  },
  {
    role: "doctor",
    label: "Doctor",
    can: "At night, pick one living player to protect.",
    cannot: "Cannot kill or see who is Mafia.",
  },
  {
    role: "detective",
    label: "Detective",
    can: "At night, investigate one player to learn if they are Mafia or not.",
    cannot: "Cannot kill or protect.",
  },
  {
    role: "civilian",
    label: "Civilian",
    can: "Discuss and vote during the day.",
    cannot: "No night action.",
  },
];

export default function HowToPlay({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="game-panel max-h-[90vh] w-[calc(100%-2rem)] max-w-md overflow-y-auto border-gray-800 bg-[#0c0c12] p-5 text-left text-gray-200 sm:rounded-2xl"
      >
        <DialogHeader className="text-left space-y-2 pr-6">
          <DialogTitle className="font-display text-2xl font-bold text-white">
            How to play
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-400 leading-relaxed">
            Everyone gets a secret role. The town tries to find the Mafia. The Mafia tries to
            outnumber or eliminate the town. Night and day take turns until one side wins.
          </DialogDescription>
        </DialogHeader>

        <section className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-amber-500/90 mb-3">
            Roles
          </h3>
          <ul className="flex flex-col gap-4">
            {ROLES.map(({ role, label, can, cannot }) => (
              <li key={role} className="flex gap-3 items-start">
                <RoleCard role={role} flipped width={64} />
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="font-semibold text-white text-base mb-1">{label}</p>
                  <p className="text-sm text-gray-300 leading-snug">
                    <span className="text-emerald-400/90">Can:</span> {can}
                  </p>
                  <p className="text-sm text-gray-400 leading-snug mt-0.5">
                    <span className="text-rose-400/80">Cannot:</span> {cannot}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-5 space-y-3 text-sm leading-relaxed">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-amber-500/90 mb-1.5">
              Night vs day
            </h3>
            <p className="text-gray-300">
              <span className="text-white font-medium">Night:</span> Quiet. Mafia, Doctor, then
              Detective take their turns.
            </p>
            <p className="text-gray-300 mt-1">
              <span className="text-white font-medium">Day:</span> Talk together, then vote to
              eliminate someone.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-amber-500/90 mb-1.5">
              Chat
            </h3>
            <p className="text-gray-300">
              Chat is only during day discussion. There is no night chat.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-amber-500/90 mb-1.5">
              Before you play
            </h3>
            <ul className="list-disc pl-4 text-gray-300 space-y-1">
              <li>Join a room. The host starts when enough players are ready (at least 3).</li>
              <li>Keep your role secret.</li>
              <li>Be kind in chat — you can report or block on day chat.</li>
            </ul>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
