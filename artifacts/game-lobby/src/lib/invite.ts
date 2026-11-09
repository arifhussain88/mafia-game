import { isInNativeApp } from "@/lib/native-bridge";

const INVITE_KEY = "mafia-invite";
const CODE_RE = /^[A-Z0-9]{5}$/;

export function inviteLink(code: string): string {
  return `${window.location.origin}/join/${code}`;
}

/**
 * A room code from an invite link (/join/ABCDE). It's remembered for this tab
 * so it survives signing in first, and the URL goes back to "/" so a reload
 * doesn't re-trigger it.
 */
export function takeInviteCode(): string | null {
  try {
    const match = window.location.pathname.match(/^\/join\/([A-Za-z0-9]{5})\/?$/);
    if (match) {
      const code = match[1].toUpperCase();
      sessionStorage.setItem(INVITE_KEY, code);
      window.history.replaceState(null, "", "/");
      return code;
    }
    const saved = sessionStorage.getItem(INVITE_KEY);
    return saved && CODE_RE.test(saved) ? saved : null;
  } catch {
    return null;
  }
}

export function clearInviteCode() {
  try { sessionStorage.removeItem(INVITE_KEY); } catch {}
}

type NativeWindow = Window & { ReactNativeWebView?: { postMessage: (msg: string) => void } };

export type ShareResult = "shared" | "copied" | "failed";

/** Open the phone's share sheet (app or browser); fall back to copying the text. */
export async function shareInvite(code: string): Promise<ShareResult> {
  return shareText(`Join my Mafia game! Room code ${code}`, inviteLink(code));
}

/** Share any text + link via the app share sheet, the Web Share API, or the clipboard. */
export async function shareText(text: string, link: string): Promise<ShareResult> {
  if (isInNativeApp()) {
    (window as NativeWindow).ReactNativeWebView?.postMessage(
      JSON.stringify({ type: "share", message: `${text}\n${link}` }),
    );
    return "shared";
  }
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: "Mafia: Town Has a Problem", text, url: link });
      return "shared";
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return "shared"; // user closed the sheet
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${link}`);
    return "copied";
  } catch {
    return "failed";
  }
}
