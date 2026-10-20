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
          className="fixed top-3 left-3 z-40 min-h-[40px] px-3 rounded-full border border-red-900/50 bg-black/70 text-red-200/90 text-xs uppercase tracking-wider font-medium cursor-pointer backdrop-blur-sm hover:bg-red-950/50"
        >
          Leave
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="game-panel border-gray-800 bg-[#0c0c12] text-gray-200">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-white">Leave this match?</AlertDialogTitle>
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
