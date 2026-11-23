import { useSyncExternalStore } from "react";

const STORAGE_KEY = "sorokit_preferences";

export const FONT_SCALE_MIN = 80;
export const FONT_SCALE_MAX = 200;
export const FONT_SCALE_STEP = 10;

export const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP"] as const;
export type DisplayCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export interface Preferences {
  /** Interface size as a percentage, from FONT_SCALE_MIN to FONT_SCALE_MAX. */
  fontScale: number;
  /** Turns off animations and transitions. */
  reduceMotion: boolean;
  /** Fiat currency balances are displayed in. */
  currency: DisplayCurrency;
}

export const DEFAULT_PREFERENCES: Preferences = {
  fontScale: 100,
  reduceMotion: false,
  currency: "USD",
};

export function clampFontScale(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PREFERENCES.fontScale;
  return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, Math.round(value)));
}

function load(): Preferences {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return DEFAULT_PREFERENCES;
    }
    const { fontScale, reduceMotion, currency } = parsed as Record<
      string,
      unknown
    >;
    return {
      fontScale:
        typeof fontScale === "number"
          ? clampFontScale(fontScale)
          : DEFAULT_PREFERENCES.fontScale,
      reduceMotion:
        typeof reduceMotion === "boolean"
          ? reduceMotion
          : DEFAULT_PREFERENCES.reduceMotion,
      currency: SUPPORTED_CURRENCIES.includes(currency as DisplayCurrency)
        ? (currency as DisplayCurrency)
        : DEFAULT_PREFERENCES.currency,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

let current: Preferences = load();
const listeners = new Set<() => void>();

export function getPreferences(): Preferences {
  return current;
}

/**
 * Writes the preferences to the document root. Font size goes through a CSS
 * variable that `index.css` turns into `zoom`, so the many fixed pixel text
 * sizes scale along with rem-based ones.
 */
export function applyPreferences(prefs: Preferences = current): void {
  const root = document.documentElement;
  root.style.setProperty("--sorokit-font-scale", String(prefs.fontScale / 100));
  if (prefs.reduceMotion) {
    root.setAttribute("data-reduce-motion", "true");
  } else {
    root.removeAttribute("data-reduce-motion");
  }
}

export function setPreferences(patch: Partial<Preferences>): void {
  const next: Preferences = {
    ...current,
    ...patch,
    fontScale: clampFontScale(patch.fontScale ?? current.fontScale),
  };
  current = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage is blocked; the choice still applies for this session.
  }
  applyPreferences(next);
  listeners.forEach((listener) => listener());
}

/** Re-reads storage. Used by tests, and after another tab changes it. */
export function reloadPreferences(): void {
  current = load();
  applyPreferences(current);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePreferences(): Preferences {
  return useSyncExternalStore(subscribe, getPreferences, getPreferences);
}
