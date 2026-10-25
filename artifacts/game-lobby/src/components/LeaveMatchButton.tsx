import { useState } from "react";
import { LogOut } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Props = {
  onConfirm: () => void;
};

export default function LeaveMatchButton({ onConfirm }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          aria-label="Leave match"
          title="Leave match"
          className="fixed top-3 left-3 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-red-900/50 bg-black/70 text-red-300 cursor-pointer backdrop-blur-sm hover:bg-red-950/50"
        >
          <LogOut className="h-5 w-5" strokeWidth={2} aria-hidden />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="game-panel border-gray-800 bg-[#0c0c12] text-gray-200">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-amber-100">Leave this match?</AlertDialogTitle>
          <AlertDialogDescription className="text-gray-400">
            You will forfeit your seat and cannot rejoin this room. After a short pause the others
            will be told you left. If you are the only living Mafia, the town wins.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="cursor-pointer">Stay</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-800 hover:bg-red-700 text-white cursor-pointer"
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            Leave match
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
