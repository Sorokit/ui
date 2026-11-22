/**
 * Minimal i18n runtime for Sorokit UI (#1157).
 *
 * A full translation framework would add a dependency to a library that is
 * otherwise presentation-only. This provider covers the three acceptance
 * criteria that matter to consumers: a locale-aware `t()` function, a
 * persisted selection, and a safe English fallback when no provider is
 * mounted (so existing consumers and tests keep working unchanged).
 */
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  DEFAULT_LOCALE,
  isLocale,
  type Locale,
  LOCALE_STORAGE_KEY,
  type TranslationKey,
  translations,
} from "./translations";

export interface I18nValue {
  locale: Locale;
  /** Change the active language. Persisted to localStorage when available. */
  setLocale: (locale: Locale) => void;
  /** Translate a known key. Never returns an empty string. */
  t: (key: TranslationKey) => string;
}

const english = translations[DEFAULT_LOCALE];

export const I18nContext = createContext<I18nValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => undefined,
  t: (key) => english[key],
});

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    // Private mode or disabled storage: fall back to English for this session.
    return DEFAULT_LOCALE;
  }
}

export interface I18nProviderProps {
  children: ReactNode;
  /** Override the initial locale; useful for server rendering or tests. */
  initialLocale?: Locale;
}

export function I18nProvider({ children, initialLocale }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() =>
    initialLocale !== undefined ? initialLocale : readStoredLocale(),
  );

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // Persistence is best effort; the in-memory selection still works.
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale,
      t: (key: TranslationKey) => translations[locale][key] ?? english[key],
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}
