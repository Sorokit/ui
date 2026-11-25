import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { logAuditEvent, reloadAuditLog } from "@/lib/audit-log";
import { ONBOARDING_REPLAY_EVENT } from "@/lib/onboarding";
import { getPreferences, reloadPreferences } from "@/lib/preferences";

import { SettingsScreen } from "./SettingsScreen";

describe("SettingsScreen", () => {
  beforeEach(() => {
    window.localStorage.clear();
    reloadPreferences();
    reloadAuditLog();
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

  describe("audit log", () => {
    it("says so when nothing has been recorded", () => {
      render(<SettingsScreen />);

      expect(screen.getByText("No activity recorded yet.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Export audit log" })).toBeDisabled();
    });

    it("lists recorded actions newest first in an accessible table", () => {
      logAuditEvent("connect", "GABC");
      logAuditEvent("send", "10 XLM to GDEST");
      render(<SettingsScreen />);

      const table = screen.getByRole("table", { name: /audit log, 2 entries/i });
      const rows = within(table).getAllByRole("row").slice(1);
      expect(rows).toHaveLength(2);
      expect(within(rows[0]).getByText("send")).toBeInTheDocument();
      expect(within(rows[0]).getByText("10 XLM to GDEST")).toBeInTheDocument();
      expect(within(rows[1]).getByText("connect")).toBeInTheDocument();
      expect(
        within(table).getAllByRole("columnheader").map((h) => h.textContent),
      ).toEqual(["Time", "Action", "Details"]);
    });

    it("shows a new entry as soon as it is recorded", () => {
      render(<SettingsScreen />);

      act(() => logAuditEvent("disconnect", "GABC"));

      expect(screen.getByText("GABC")).toBeInTheDocument();
    });

    it("exports the log as a CSV file", async () => {
      const user = userEvent.setup();
      logAuditEvent("connect", "GABC");
      const originalCreate = URL.createObjectURL;
      const originalRevoke = URL.revokeObjectURL;
      const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:audit");
      URL.createObjectURL = createObjectURL;
      URL.revokeObjectURL = vi.fn();
      const click = vi
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(() => {});

      try {
        render(<SettingsScreen />);
        await user.click(screen.getByRole("button", { name: "Export audit log" }));

        expect(click).toHaveBeenCalledTimes(1);
        expect(createObjectURL.mock.calls[0][0].type).toBe("text/csv;charset=utf-8;");
      } finally {
        URL.createObjectURL = originalCreate;
        URL.revokeObjectURL = originalRevoke;
        click.mockRestore();
      }
    });
  });
});
