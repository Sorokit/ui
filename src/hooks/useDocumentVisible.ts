import { useEffect, useState } from "react";

/**
 * Tracks `document.visibilityState` so polling components can pause work
 * while the browser tab is hidden/backgrounded and resume on focus.
 *
 * This is tab-visibility, not layout-visibility: `useIsVisible`
 * (IntersectionObserver) already pauses polling when the component is
 * hidden by layout, but a backgrounded tab keeps firing intervals and
 * burning RPC rate limits. Returns `true` when `document` is unavailable
 * (SSR, non-DOM test envs) so data loading fails open.
 */
export function useDocumentVisible(): boolean {
  // Anything but "hidden" counts as visible: real tabs report "visible",
  // while jsdom reports "prerender" by default — treating only "hidden" as
  // paused keeps data loading working in tests and SSR.
  const [visible, setVisible] = useState(() =>
    typeof document === "undefined"
      ? true
      : document.visibilityState !== "hidden",
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onChange = () =>
      setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  return visible;
}
