import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ONBOARDING_REPLAY_EVENT } from "@/lib/onboarding";
import { getPreferences, reloadPreferences } from "@/lib/preferences";

import { SettingsScreen } from "./SettingsScreen";

describe("SettingsScreen", () => {
  beforeEach(() => {
    window.localStorage.clear();
    reloadPreferences();
  });

  it("replays the tutorial from the Replay tutorial button", async () => {
    const user = userEvent.setup();
    const onReplay = vi.fn();
    window.addEventListener(ONBOARDING_REPLAY_EVENT, onReplay);
    render(<SettingsScreen />);

    await user.click(screen.getByRole("button", { name: "Replay tutorial" }));

    expect(onReplay).toHaveBeenCalledTimes(1);
    window.removeEventListener(ONBOARDING_REPLAY_EVENT, onReplay);
  });

  it("offers a font size slider from 80% to 200% that is saved", () => {
    render(<SettingsScreen />);
    const slider = screen.getByRole("slider", { name: /font size/i });

    expect(slider).toHaveAttribute("min", "80");
    expect(slider).toHaveAttribute("max", "200");
    expect(screen.getByTestId("font-scale-value")).toHaveTextContent("100%");

    fireEvent.change(slider, { target: { value: "160" } });

    expect(screen.getByTestId("font-scale-value")).toHaveTextContent("160%");
    expect(getPreferences().fontScale).toBe(160);
    expect(window.localStorage.getItem("sorokit_preferences")).toContain("160");
  });

  it("toggles reduced motion and saves it", async () => {
    const user = userEvent.setup();
    render(<SettingsScreen />);
    const toggle = screen.getByRole("checkbox", { name: "Reduce motion" });
    expect(toggle).not.toBeChecked();

    await user.click(toggle);

    expect(toggle).toBeChecked();
    expect(getPreferences().reduceMotion).toBe(true);
    expect(document.documentElement).toHaveAttribute("data-reduce-motion", "true");
  });

  it("lists USD, EUR and GBP and saves the chosen display currency", async () => {
    const user = userEvent.setup();
    render(<SettingsScreen />);
    const select = screen.getByRole("combobox", { name: "Currency" });

    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["USD", "EUR", "GBP"]);
    expect(select).toHaveValue("USD");

    await user.selectOptions(select, "EUR");

    expect(select).toHaveValue("EUR");
    expect(getPreferences().currency).toBe("EUR");
    expect(window.localStorage.getItem("sorokit_preferences")).toContain("EUR");
  });

  it("shows the saved preferences when it is opened again", () => {
    window.localStorage.setItem(
      "sorokit_preferences",
      JSON.stringify({ fontScale: 130, reduceMotion: true, currency: "GBP" }),
    );
    reloadPreferences();

    render(<SettingsScreen />);

    expect(screen.getByTestId("font-scale-value")).toHaveTextContent("130%");
    expect(screen.getByRole("checkbox", { name: "Reduce motion" })).toBeChecked();
    expect(screen.getByRole("combobox", { name: "Currency" })).toHaveValue("GBP");
  });
});
