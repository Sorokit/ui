import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { hasSeenOnboarding, requestOnboardingReplay } from "@/lib/onboarding";

import { ONBOARDING_STEPS, OnboardingTutorial } from "./OnboardingTutorial";

describe("OnboardingTutorial", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("appears on the first visit", () => {
    render(<OnboardingTutorial />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(ONBOARDING_STEPS[0].title)).toBeInTheDocument();
    expect(screen.getByTestId("onboarding-progress")).toHaveTextContent(
      `Step 1 of ${ONBOARDING_STEPS.length}`,
    );
  });

  it("does not appear once it has been seen", () => {
    window.localStorage.setItem("sorokit_onboarding_seen", "true");

    render(<OnboardingTutorial />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("steps forward and back through every step", async () => {
    const user = userEvent.setup();
    render(<OnboardingTutorial />);

    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
    for (let i = 1; i < ONBOARDING_STEPS.length; i++) {
      await user.click(screen.getByRole("button", { name: "Next" }));
      expect(screen.getByText(ONBOARDING_STEPS[i].title)).toBeInTheDocument();
    }

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(
      screen.getByText(ONBOARDING_STEPS[ONBOARDING_STEPS.length - 2].title),
    ).toBeInTheDocument();
  });

  it("can be skipped from the first step and is remembered", async () => {
    const user = userEvent.setup();
    render(<OnboardingTutorial />);

    await user.click(screen.getByRole("button", { name: "Skip tutorial" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(hasSeenOnboarding()).toBe(true);
  });

  it("can be closed with Escape and with the close button", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<OnboardingTutorial />);

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    unmount();

    window.localStorage.clear();
    render(<OnboardingTutorial />);
    await user.click(screen.getByRole("button", { name: "Close tutorial" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("finishes on the last step with Done", async () => {
    const user = userEvent.setup();
    render(<OnboardingTutorial />);

    for (let i = 1; i < ONBOARDING_STEPS.length; i++) {
      await user.click(screen.getByRole("button", { name: "Next" }));
    }
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(hasSeenOnboarding()).toBe(true);
  });

  it("reopens from the first step when a replay is requested", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("sorokit_onboarding_seen", "true");
    render(<OnboardingTutorial />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    act(() => requestOnboardingReplay());

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(ONBOARDING_STEPS[0].title)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Skip tutorial" }));
    act(() => requestOnboardingReplay());
    expect(screen.getByText(ONBOARDING_STEPS[0].title)).toBeInTheDocument();
  });
});
