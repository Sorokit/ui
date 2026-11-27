import { useEffect, useState } from "react";

function readOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

/**
 * Tracks the browser's connectivity (#1163). Starts from `navigator.onLine`
 * and follows the window `online` / `offline` events.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(readOnline);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    // Resync in case the state changed between render and effect.
    let active = true;
    queueMicrotask(() => {
      if (active) setOnline(readOnline());
    });
    return () => {
      active = false;
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
