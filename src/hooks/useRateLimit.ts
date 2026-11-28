import { useEffect, useSyncExternalStore } from "react";

import {
  type RateLimitConfig,
  type RateLimitSnapshot,
  type RateLimitTracker,
  rateLimitTracker,
} from "@/lib/rate-limit";

export interface UseRateLimitResult extends RateLimitSnapshot {
  config: RateLimitConfig;
  /** Update the quota / warning threshold (persisted). */
  setConfig: (patch: Partial<RateLimitConfig>) => void;
}

/**
 * Subscribes to API-call usage (#1162). Re-evaluates once a second so calls
 * age out of the sliding window and the warning clears on its own.
 */
export function useRateLimit(
  tracker: RateLimitTracker = rateLimitTracker,
): UseRateLimitResult {
  const snapshot = useSyncExternalStore(
    tracker.subscribe,
    tracker.getSnapshot,
    tracker.getSnapshot,
  );

  useEffect(() => {
    const id = window.setInterval(() => tracker.tick(), 1000);
    return () => window.clearInterval(id);
  }, [tracker]);

  return {
    ...snapshot,
    config: tracker.getConfig(),
    setConfig: (patch) => tracker.setConfig(patch),
  };
}
