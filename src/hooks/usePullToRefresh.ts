import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook implementing a mobile pull-to-refresh gesture: dragging down from the
 * top of the referenced element past `threshold` px and releasing calls
 * `onRefresh`. Only arms when the element is already scrolled to its top
 * (`scrollTop === 0`), so pulling down mid-scroll never gets mistaken for a
 * refresh gesture.
 *
 * Returns the ref to attach to the scrollable container, the current pull
 * distance in px (0 when idle, clamped to `threshold * 1.5` so the visual
 * indicator never overshoots), and whether a refresh triggered by this
 * gesture is in flight.
 */
export function usePullToRefresh<T extends HTMLElement = HTMLElement>(
  onRefresh: () => void | Promise<void>,
  options: { threshold?: number; enabled?: boolean } = {},
) {
  const { threshold = 64, enabled = true } = options;
  const ref = useRef<T>(null);
  const onRefreshRef = useRef(onRefresh);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const startY = useRef<number | null>(null);
  const isPulling = useRef(false);

  const handleTouchStart = useCallback((event: TouchEvent) => {
    const el = ref.current;
    if (!el || el.scrollTop > 0) {
      startY.current = null;
      isPulling.current = false;
      return;
    }
    startY.current = event.touches[0]?.clientY ?? null;
    isPulling.current = true;
  }, []);

  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (!isPulling.current || startY.current === null) return;
    const currentY = event.touches[0]?.clientY ?? startY.current;
    const delta = currentY - startY.current;
    if (delta <= 0) {
      setPullDistance(0);
      return;
    }
    setPullDistance(Math.min(delta, threshold * 1.5));
  }, [threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return;
    isPulling.current = false;
    startY.current = null;

    const shouldRefresh = pullDistance >= threshold;
    setPullDistance(0);

    if (shouldRefresh) {
      setIsRefreshing(true);
      try {
        await onRefreshRef.current();
      } finally {
        setIsRefreshing(false);
      }
    }
  }, [pullDistance, threshold]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: true });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { ref, pullDistance, isRefreshing, threshold };
}
