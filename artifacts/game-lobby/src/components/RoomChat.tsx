import { useEffect, useRef, useState } from "react";

type ChatMessage = { id: string; name: string; text: string };

type Props = {
  myName: string;
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onReport: (id: string) => void;
  onBlock: (name: string) => void;
};

export default function RoomChat({ myName, messages, onSend, onReport, onBlock }: Props) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  return (
    <div className="fixed bottom-3 right-3 z-40 w-[min(92vw,20rem)] flex flex-col items-end gap-2">
      {open && (
        <div className="game-panel w-full px-3 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.55)]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-amber-600/90 font-semibold">Room chat</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[10px] uppercase tracking-wide text-gray-500 hover:text-gray-300 cursor-pointer"
            >
              Hide
            </button>
          </div>
          <div
            ref={listRef}
            className="max-h-40 overflow-y-auto rounded-xl bg-black/30 border border-white/5 px-3 py-2 flex flex-col gap-2"
          >
            {messages.length === 0 ? (
              <p className="text-gray-600 text-xs">No messages yet.</p>
            ) : (
              messages.map((message) => (
                <div key={message.id} className="flex items-start justify-between gap-2">
                  <p className="text-sm text-gray-200 break-words min-w-0">
                    <span className="font-semibold text-amber-200">{message.name}: </span>
                    {message.text}
                  </p>
                  {message.name !== myName && (
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => onReport(message.id)}
                        className="text-[10px] uppercase tracking-wide text-amber-700/80 hover:text-amber-500 cursor-pointer"
                      >
                        Report
                      </button>
                      <button
                        type="button"
                        onClick={() => onBlock(message.name)}
                        className="text-[10px] uppercase tracking-wide text-gray-500 hover:text-red-400 cursor-pointer"
                      >
                        Block
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const text = draft.trim();
              if (!text) return;
              onSend(text);
              setDraft("");
            }}
          >
            <input
              value={draft}
              maxLength={200}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Message the room"
              className="flex-1 min-h-[40px] px-3 rounded-xl bg-gray-900 border border-gray-700 text-white text-sm"
            />
            <button
              type="submit"
              className="min-h-[40px] px-3 rounded-xl bg-amber-700 text-white text-sm font-semibold cursor-pointer"
            >
              Send
            </button>
          </form>
        </div>
      )}

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-[44px] px-4 rounded-full border border-amber-900/60 bg-black/70 text-amber-100 text-sm font-medium cursor-pointer shadow-lg backdrop-blur-sm hover:bg-black/85"
        >
          Chat{messages.length > 0 ? ` (${messages.length})` : ""}
        </button>
      )}
    </div>
  );
}
