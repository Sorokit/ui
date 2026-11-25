const STORAGE_KEY = "sorokit_onboarding_seen";

/** Fired on `window` to ask the mounted tutorial to open again from step one. */
export const ONBOARDING_REPLAY_EVENT = "sorokit:replay-onboarding";

/**
 * Whether the tutorial has already been finished or skipped. If storage is
 * unavailable this reports `true`, so a browser that can't remember the choice
 * isn't shown the tutorial on every visit.
 */
export function hasSeenOnboarding(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return true;
  }
}

export function markOnboardingSeen(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    // Storage is blocked; the tutorial just won't be remembered.
  }
}

export function requestOnboardingReplay(): void {
  window.dispatchEvent(new CustomEvent(ONBOARDING_REPLAY_EVENT));
}
