import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyPreferences,
  clampFontScale,
  DEFAULT_PREFERENCES,
  getPreferences,
  reloadPreferences,
  setPreferences,
  usePreferences,
} from "./preferences";

const STORAGE_KEY = "sorokit_preferences";

describe("preferences", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    reloadPreferences();
  });

  it("starts from the defaults", () => {
    expect(getPreferences()).toEqual(DEFAULT_PREFERENCES);
    expect(DEFAULT_PREFERENCES).toEqual({ fontScale: 100, reduceMotion: false });
  });

  it("clamps the font size to 80%-200%", () => {
    expect(clampFontScale(50)).toBe(80);
    expect(clampFontScale(80)).toBe(80);
    expect(clampFontScale(150)).toBe(150);
    expect(clampFontScale(200)).toBe(200);
    expect(clampFontScale(400)).toBe(200);
    expect(clampFontScale(Number.NaN)).toBe(100);
  });

  it("persists changes to localStorage", () => {
    setPreferences({ fontScale: 140 });
    setPreferences({ reduceMotion: true });

    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}")).toEqual({
      fontScale: 140,
      reduceMotion: true,
    });
  });

  it("restores saved preferences on reload", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ fontScale: 180, reduceMotion: true }),
    );

    reloadPreferences();

    expect(getPreferences()).toEqual({ fontScale: 180, reduceMotion: true });
  });

  it("falls back to the defaults for corrupt or out-of-range saved values", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not json");
    reloadPreferences();
    expect(getPreferences()).toEqual(DEFAULT_PREFERENCES);

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ fontScale: 900, reduceMotion: "yes" }),
    );
    reloadPreferences();
    expect(getPreferences()).toEqual({ fontScale: 200, reduceMotion: false });
  });

  it("applies the font size and reduced motion to the document root", () => {
    setPreferences({ fontScale: 150, reduceMotion: true });

    const root = document.documentElement;
    expect(root.style.getPropertyValue("--sorokit-font-scale")).toBe("1.5");
    expect(root).toHaveAttribute("data-reduce-motion", "true");

    setPreferences({ reduceMotion: false });
    expect(root).not.toHaveAttribute("data-reduce-motion");

    applyPreferences({ fontScale: 80, reduceMotion: false });
    expect(root.style.getPropertyValue("--sorokit-font-scale")).toBe("0.8");
  });

  it("still applies a change when storage is blocked", () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => setPreferences({ fontScale: 120 })).not.toThrow();
    expect(getPreferences().fontScale).toBe(120);
  });

  it("re-renders hook users when a preference changes", () => {
    const { result } = renderHook(() => usePreferences());
    expect(result.current.fontScale).toBe(100);

    act(() => setPreferences({ fontScale: 170 }));

    expect(result.current.fontScale).toBe(170);
  });
});
