/**
 * API rate-limit tracking (#1162).
 *
 * Counts client calls inside a sliding window and reports how close the app is
 * to its quota, so the UI can warn *before* the API starts rejecting requests.
 * The quota and the warning threshold are user-configurable and persisted.
 */

import type { SorokitClient } from "./client";

const STORAGE_KEY = "sorokit_rate_limit_config";
/** A 429 seen this recently keeps the indicator in the "critical" state. */
const LIMITED_HOLD_MS = 30_000;

export interface RateLimitConfig {
  /** Max API calls allowed per window (the quota being approached). */
  limit: number;
  /** Fraction of `limit` (0-1) at which the warning appears. */
  threshold: number;
  /** Sliding-window length in milliseconds. */
  windowMs: number;
}

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  limit: 100,
  threshold: 0.8,
  windowMs: 60_000,
};

export type RateLimitLevel = "ok" | "warning" | "critical";

export interface RateLimitSnapshot {
  /** Calls made inside the current window. */
  count: number;
  limit: number;
  threshold: number;
  windowMs: number;
  /** count / limit, uncapped. */
  ratio: number;
  level: RateLimitLevel;
  /** True when the API itself recently answered with a rate-limit error. */
  limited: boolean;
  /** Milliseconds until the oldest counted call leaves the window. */
  resetsInMs: number;
}

/** Clamp user input into sane bounds so a typo can't disable the warning. */
export function sanitizeConfig(
  input: Partial<RateLimitConfig>,
  base: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG,
): RateLimitConfig {
  const limit = Number(input.limit ?? base.limit);
  const threshold = Number(input.threshold ?? base.threshold);
  const windowMs = Number(input.windowMs ?? base.windowMs);
  return {
    limit: Number.isFinite(limit) && limit >= 1 ? Math.floor(limit) : base.limit,
    threshold:
      Number.isFinite(threshold) && threshold > 0 && threshold <= 1
        ? threshold
        : base.threshold,
    windowMs:
      Number.isFinite(windowMs) && windowMs >= 1000 ? windowMs : base.windowMs,
  };
}

function loadConfig(): RateLimitConfig {
  try {
    if (typeof window === "undefined") return DEFAULT_RATE_LIMIT_CONFIG;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_RATE_LIMIT_CONFIG;
    return sanitizeConfig(JSON.parse(raw));
  } catch {
    return DEFAULT_RATE_LIMIT_CONFIG;
  }
}

/** True when an API error message looks like an HTTP 429 / throttling error. */
export function isRateLimitError(error: unknown): boolean {
  if (typeof error !== "string") return false;
  const e = error.toLowerCase();
  return (
    e.includes("429") ||
    e.includes("rate limit") ||
    e.includes("rate-limit") ||
    e.includes("too many requests")
  );
}

export class RateLimitTracker {
  private calls: number[] = [];
  private limitedAt: number | null = null;
  private config: RateLimitConfig;
  private snapshot: RateLimitSnapshot;
  private listeners = new Set<() => void>();
  private persisted: boolean;

  constructor(config?: Partial<RateLimitConfig>, persisted = true) {
    this.persisted = persisted;
    this.config = config
      ? sanitizeConfig(config)
      : persisted
        ? loadConfig()
        : DEFAULT_RATE_LIMIT_CONFIG;
    this.snapshot = this.compute(Date.now());
  }

  private compute(now: number): RateLimitSnapshot {
    const { limit, threshold, windowMs } = this.config;
    this.calls = this.calls.filter((t) => now - t < windowMs);
    const count = this.calls.length;
    const ratio = count / limit;
    const limited =
      this.limitedAt !== null && now - this.limitedAt < LIMITED_HOLD_MS;
    const level: RateLimitLevel =
      limited || ratio >= 1 ? "critical" : ratio >= threshold ? "warning" : "ok";
    const resetsInMs = this.calls.length
      ? Math.max(0, windowMs - (now - this.calls[0]))
      : 0;
    return { count, limit, threshold, windowMs, ratio, level, limited, resetsInMs };
  }

  /** Recompute and notify only when something visible actually changed. */
  private refresh(now = Date.now()): void {
    const next = this.compute(now);
    const prev = this.snapshot;
    const changed =
      next.count !== prev.count ||
      next.level !== prev.level ||
      next.limited !== prev.limited ||
      next.limit !== prev.limit ||
      next.threshold !== prev.threshold ||
      next.windowMs !== prev.windowMs ||
      // Only countdown-driven changes while something is being counted.
      (next.count > 0 && next.resetsInMs !== prev.resetsInMs);
    if (!changed) return;
    this.snapshot = next;
    this.listeners.forEach((l) => l());
  }

  /** Record one API call. */
  record(now = Date.now()): void {
    this.calls.push(now);
    this.refresh(now);
  }

  /** Record that the API answered with a rate-limit error. */
  noteLimited(now = Date.now()): void {
    this.limitedAt = now;
    this.refresh(now);
  }

  /** Re-evaluate the window (call on a timer so old calls age out). */
  tick(now = Date.now()): void {
    this.refresh(now);
  }

  getSnapshot = (): RateLimitSnapshot => this.snapshot;

  getConfig(): RateLimitConfig {
    return this.config;
  }

  setConfig(patch: Partial<RateLimitConfig>): void {
    this.config = sanitizeConfig(patch, this.config);
    if (this.persisted) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
      } catch {
        /* best-effort */
      }
    }
    this.refresh();
  }

  reset(): void {
    this.calls = [];
    this.limitedAt = null;
    this.refresh();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}

/** Shared tracker used by the dashboard indicator and `trackClientCalls`. */
export const rateLimitTracker = new RateLimitTracker();

/**
 * Wrap a client so every async method call is counted by `tracker`. Opt-in:
 * the provider is untouched, so consumers choose whether to meter their
 * client. Results carrying a rate-limit error also flag the tracker.
 */
export function trackClientCalls<T extends SorokitClient>(
  client: T,
  tracker: RateLimitTracker = rateLimitTracker,
): T {
  const wrapGroup = (group: unknown): unknown => {
    if (!group || typeof group !== "object") return group;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(group)) {
      if (typeof value !== "function") {
        out[key] = value;
        continue;
      }
      out[key] = (...args: unknown[]) => {
        tracker.record();
        const result = (value as (...a: unknown[]) => unknown).apply(group, args);
        if (result && typeof (result as Promise<unknown>).then === "function") {
          (result as Promise<unknown>).then(
            (res) => {
              if (isRateLimitError((res as { error?: unknown } | null)?.error)) {
                tracker.noteLimited();
              }
            },
            (err) => {
              if (isRateLimitError(err instanceof Error ? err.message : err)) {
                tracker.noteLimited();
              }
            },
          );
        }
        return result;
      };
    }
    return out;
  };

  const wrapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(client)) {
    wrapped[key] = wrapGroup(value);
  }
  return wrapped as T;
}
