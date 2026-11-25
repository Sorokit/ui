/**
 * Offline cache (#1163) — persists the last-known account, balances and
 * transaction history in localStorage so the UI can still show something
 * useful when the network or the API is unreachable.
 *
 * Entries are keyed by network + address so a testnet snapshot never leaks
 * into a mainnet session. All storage access is wrapped: private windows,
 * blocked storage and SSR must never break the app — caching is best-effort.
 */

import type { AccountData, Balance, Transaction } from "./client";

const CACHE_PREFIX = "sorokit_offline_cache";

/** Snapshot of everything we keep for one network + address pair. */
export interface OfflineSnapshot {
  account?: AccountData;
  balances?: Balance[];
  /** Cached transaction pages, keyed by page number. */
  transactions?: Record<number, { items: Transaction[]; total: number }>;
  /** Epoch ms of the last successful write. */
  cachedAt: number;
}

function cacheKey(network: string | null | undefined, address: string): string {
  return `${CACHE_PREFIX}:${network ?? "default"}:${address}`;
}

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readSnapshot(
  network: string | null | undefined,
  address: string,
): OfflineSnapshot | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(cacheKey(network, address));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OfflineSnapshot;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Merge `patch` into the stored snapshot (so caching balances doesn't wipe
 * cached transactions) and stamp it with the current time.
 */
export function writeSnapshot(
  network: string | null | undefined,
  address: string,
  patch: Partial<Omit<OfflineSnapshot, "cachedAt">>,
): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    const existing = readSnapshot(network, address);
    const next: OfflineSnapshot = {
      ...existing,
      ...patch,
      transactions: { ...existing?.transactions, ...patch.transactions },
      cachedAt: Date.now(),
    };
    storage.setItem(cacheKey(network, address), JSON.stringify(next));
  } catch {
    /* quota exceeded / storage blocked — caching is best-effort */
  }
}

export function clearSnapshot(
  network: string | null | undefined,
  address: string,
): void {
  try {
    getStorage()?.removeItem(cacheKey(network, address));
  } catch {
    /* ignore */
  }
}

/** Human-readable "x minutes ago" for the offline badge tooltip. */
export function formatCachedAge(cachedAt: number | null, now = Date.now()): string {
  if (!cachedAt) return "unknown time";
  const seconds = Math.max(0, Math.round((now - cachedAt) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}
