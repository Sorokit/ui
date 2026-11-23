import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ONBOARDING_REPLAY_EVENT } from "@/lib/onboarding";

import { SettingsScreen } from "./SettingsScreen";

describe("SettingsScreen", () => {
  it("replays the tutorial from the Replay tutorial button", async () => {
    const user = userEvent.setup();
    const onReplay = vi.fn();
    window.addEventListener(ONBOARDING_REPLAY_EVENT, onReplay);
    render(<SettingsScreen />);

    await user.click(screen.getByRole("button", { name: "Replay tutorial" }));

    expect(onReplay).toHaveBeenCalledTimes(1);
    window.removeEventListener(ONBOARDING_REPLAY_EVENT, onReplay);
  });
});
