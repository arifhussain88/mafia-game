import { useEffect, useRef } from "react";

/**
 * Bridge to the Expo WebView wrapper (artifacts/mobile-app/App.tsx).
 * The wrapper turns the Android back button into a `mafia-back` window event
 * instead of navigating WebView history (which would unload the game).
 */
export const BACK_EVENT = "mafia-back";

type NativeWindow = Window & { ReactNativeWebView?: { postMessage: (msg: string) => void } };

export function isInNativeApp(): boolean {
  return typeof window !== "undefined" && Boolean((window as NativeWindow).ReactNativeWebView);
}

/** Ask the wrapper to close the app (back pressed on the root screen). */
export function requestAppExit() {
  (window as NativeWindow).ReactNativeWebView?.postMessage(JSON.stringify({ type: "exit" }));
}

/** Run `handler` on Android back while `enabled`. Latest handler is always used. */
export function useBackHandler(handler: () => void, enabled = true) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const listener = () => ref.current();
    window.addEventListener(BACK_EVENT, listener);
    return () => window.removeEventListener(BACK_EVENT, listener);
  }, [enabled]);
}
