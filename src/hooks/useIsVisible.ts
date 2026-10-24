import { useEffect, useRef, useState } from "react";

export interface UseIsVisibleOptions {
  /**
   * IntersectionObserver threshold(s). Defaults to `0` — any non-zero
   * intersection counts as visible. Raise it (or pass an array) when a
   * component should only be considered "visible" once enough of it is on
   * screen, e.g. to gate an expensive animation on a mostly-visible panel.
   */
  threshold?: number | number[];
  /**
   * IntersectionObserver rootMargin. Useful to start/stop work slightly
   * before an element actually enters the viewport (e.g. `"200px"`).
   */
  rootMargin?: string;
  /**
   * IntersectionObserver root. Defaults to the viewport; pass a scroll
   * container when visibility should be measured against it instead.
   */
  root?: Element | Document | null;
}

/**
 * Tracks whether the element `ref` is attached to currently has a laid-out,
 * non-zero-area box — i.e. it isn't `display: none` (directly, or via a
 * `hidden` ancestor) and isn't scrolled fully out of any clipping
 * container. Backed by `IntersectionObserver`, so this is layout-driven,
 * not viewport-scroll-driven: an element under `hidden` reports `false`
 * immediately, with no scrolling involved.
 *
 * Built for `Dashboard`'s "mount once, keep alive" screens (see
 * `Dashboard.tsx`): a screen that isn't the active tab is still mounted
 * (its form state and subscriptions survive navigating away) but is
 * wrapped in an element with the `hidden` attribute. A component that
 * polls — `FeeEstimator`, `ContractEventFeed` — uses this to pause that
 * polling while its screen isn't the one showing, instead of either
 * polling forever in the background or requiring `Dashboard` to thread an
 * `isActive` prop through every screen and every component that polls.
 *
 * Returns `true` before the first observer callback fires (optimistic —
 * assume visible until proven otherwise) so a component doesn't skip its
 * very first load while waiting on the initial IntersectionObserver
 * entry, which can arrive a frame or two after mount.
 */
export function useIsVisible<T extends Element>(
  options: UseIsVisibleOptions = {},
): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const { threshold = 0, rootMargin, root } = options;

  // Thresholds are commonly passed as an inline array, which would be a new
  // identity on every render and needlessly tear down/recreate the observer.
  // Key the effect on the serialized value instead.
  const thresholdKey = Array.isArray(threshold)
    ? threshold.join(",")
    : String(threshold);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // No IntersectionObserver (very old browser, or a non-DOM test
    // environment that doesn't polyfill it) — fail open rather than
    // silently never polling.
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) setIsVisible(entry.isIntersecting);
      },
      // Default threshold: 0 — any non-zero intersection counts as visible;
      // this is a mount-gate, not a "is it prominently on screen" measurement.
      { threshold, rootMargin, root },
    );
    observer.observe(node);
    return () => observer.disconnect();
    // `thresholdKey` stands in for `threshold` (which may be an array);
    // numeric/string options are compared by value, `root` by identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thresholdKey, rootMargin, root]);

  return [ref, isVisible];
}
