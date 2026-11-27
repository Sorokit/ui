import { useSyncExternalStore } from "react";

function readOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/**
 * Tracks the browser's connectivity (#1163). Starts from `navigator.onLine`
 * and follows the window `online` / `offline` events.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, readOnline, () => true);
}
