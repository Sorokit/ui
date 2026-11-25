import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  hasSeenOnboarding,
  markOnboardingSeen,
  ONBOARDING_REPLAY_EVENT,
  requestOnboardingReplay,
} from "./onboarding";

describe("onboarding storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("has not been seen on a first visit", () => {
    expect(hasSeenOnboarding()).toBe(false);
  });

  it("remembers that the tutorial was seen", () => {
    markOnboardingSeen();

    expect(hasSeenOnboarding()).toBe(true);
  });

  it("treats the tutorial as seen when storage is unavailable", () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(hasSeenOnboarding()).toBe(true);
    expect(() => markOnboardingSeen()).not.toThrow();
  });

  it("dispatches the replay event on window", () => {
    const listener = vi.fn();
    window.addEventListener(ONBOARDING_REPLAY_EVENT, listener);

    requestOnboardingReplay();

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(ONBOARDING_REPLAY_EVENT, listener);
  });
});
