import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const REPORT_REASONS = [
  ["offensive-name", "Offensive name"],
  ["harassment", "Harassment or bullying"],
  ["hate", "Hate speech"],
  ["sexual", "Sexual content"],
  ["cheating", "Cheating"],
  ["spam", "Spam"],
  ["other", "Something else"],
] as const;

type Props = {
  playerName: string | null;
  onClose: () => void;
  onSubmit: (reason: string) => void;
};

/** Pick a reason, then send. Reports go to the developer for review (Play UGC policy). */
export default function ReportPlayerDialog({ playerName, onClose, onSubmit }: Props) {
  const [reason, setReason] = useState<string>("offensive-name");
  return (
    <AlertDialog open={playerName !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialogContent className="game-panel border-gray-800 bg-[#121110] text-gray-200">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-amber-100">Report {playerName}?</AlertDialogTitle>
          <AlertDialogDescription className="text-gray-400">
            Reports are reviewed, and players who break the rules can be suspended. They won't know who reported them.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <fieldset className="flex flex-col gap-1.5" aria-label="Reason">
          {REPORT_REASONS.map(([value, label]) => (
            <label
              key={value}
              className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-3 text-sm ring-1 transition-colors ${
                reason === value ? "bg-amber-950/40 ring-amber-600/60 text-white" : "ring-white/10 text-gray-300 hover:bg-white/5"
              }`}
            >
              <input
                type="radio"
                name="report-reason"
                value={value}
                checked={reason === value}
                onChange={() => setReason(value)}
                className="accent-amber-600"
              />
              {label}
            </label>
          ))}
        </fieldset>
        <AlertDialogFooter>
          <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-800 hover:bg-red-700 text-white cursor-pointer"
            onClick={() => onSubmit(reason)}
          >
            Send report
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
