import { useEffect, useRef, useState } from "react";
import { MessageCircle, MoreHorizontal, X } from "lucide-react";
import { playChatPing } from "@/lib/audio";

type ChatMessage = { id: string; name: string; text: string };

type Props = {
  myName: string;
  messages: ChatMessage[];
  canSend?: boolean;
  onSend: (text: string) => void;
  onReport: (id: string) => void;
  onBlock: (name: string) => void;
};

export default function RoomChat({
  myName,
  messages,
  canSend = true,
  onSend,
  onReport,
  onBlock,
}: Props) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [menuForId, setMenuForId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const prevLenRef = useRef(messages.length);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  useEffect(() => {
    const prev = prevLenRef.current;
    const next = messages.length;
    prevLenRef.current = next;
    // Only react to a single append (live message), not bulk history replace
    if (next !== prev + 1) return;
    const newest = messages[next - 1];
    if (!newest || newest.name === myName) return;
    if (openRef.current) return;
    setUnread((n) => n + 1);
    playChatPing();
  }, [messages, myName]);

  function openPanel() {
    setOpen(true);
    setUnread(0);
    setMenuForId(null);
  }

  function closePanel() {
    setOpen(false);
    setMenuForId(null);
  }

  return (
    <div className="fixed bottom-3 right-3 z-40 w-[min(92vw,20rem)] flex flex-col items-end gap-2">
      {open && (
        <div className="game-panel w-full px-3 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.55)]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-amber-600/90 font-semibold">
              Room chat
            </p>
            <button
              type="button"
              onClick={closePanel}
              aria-label="Close chat"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:text-amber-200 cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div
            ref={listRef}
            className="max-h-40 overflow-y-auto rounded-xl bg-black/30 border border-white/5 px-3 py-2 flex flex-col gap-2"
          >
            {messages.length === 0 ? (
              <p className="text-gray-500 text-xs">No messages yet.</p>
            ) : (
              messages.map((message) => (
                <div key={message.id} className="flex items-start justify-between gap-2 relative">
                  <p className="text-sm text-gray-200 break-words min-w-0">
                    <span className="font-semibold text-amber-200">{message.name}: </span>
                    {message.text}
                  </p>
                  {message.name !== myName && (
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        aria-label="Message options"
                        onClick={() =>
                          setMenuForId((id) => (id === message.id ? null : message.id))
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-md text-amber-700/80 hover:text-amber-400 cursor-pointer"
                      >
                        <MoreHorizontal className="h-4 w-4" aria-hidden />
                      </button>
                      {menuForId === message.id && (
                        <div className="absolute right-0 top-8 z-10 min-w-[9.5rem] rounded-lg border border-amber-900/40 bg-[#0c0c12] py-1 shadow-xl">
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-xs text-amber-200 hover:bg-amber-950/40 cursor-pointer"
                            onClick={() => {
                              onReport(message.id);
                              setMenuForId(null);
                            }}
                          >
                            Report message
                          </button>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-xs text-red-300 hover:bg-red-950/30 cursor-pointer"
                            onClick={() => {
                              onBlock(message.name);
                              setMenuForId(null);
                            }}
                          >
                            Block player
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          {canSend ? (
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
                className="min-h-[40px] px-3 rounded-xl bg-amber-700 text-amber-50 text-sm font-semibold cursor-pointer"
              >
                Send
              </button>
            </form>
          ) : (
            <p className="mt-2 text-center text-[11px] text-gray-500">
              You’re eliminated — you can read chat only.
            </p>
          )}
        </div>
      )}

      {!open && (
        <button
          type="button"
          onClick={openPanel}
          aria-label={unread > 0 ? `Chat, ${unread} unread` : "Open chat"}
          title="Chat"
          className="relative flex h-12 w-12 items-center justify-center rounded-full border border-amber-900/60 bg-black/70 text-amber-100 cursor-pointer shadow-lg backdrop-blur-sm hover:bg-black/85"
        >
          <MessageCircle className="h-5 w-5" aria-hidden />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white leading-none">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
