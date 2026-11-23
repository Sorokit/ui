import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  loadPriceAlertHistory,
  loadPriceAlerts,
  PriceAlertManager,
} from "./PriceAlertManager";

describe("PriceAlertManager (#1148)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("allows configuring alert threshold and persists to localStorage", () => {
    render(<PriceAlertManager currentPrice={0.1} asset="XLM" />);

    const input = screen.getByTestId("alert-threshold-input");
    const selectCond = screen.getByTestId("alert-condition-select");
    const selectAsset = screen.getByTestId("alert-asset-select");
    const submitBtn = screen.getByTestId("create-alert-button");

    fireEvent.change(selectAsset, { target: { value: "USDC" } });
    fireEvent.change(selectCond, { target: { value: "above" } });
    fireEvent.change(input, { target: { value: "1.05" } });
    fireEvent.click(submitBtn);

    const savedAlerts = loadPriceAlerts();
    expect(savedAlerts.some((a) => a.asset === "USDC" && a.threshold === 1.05)).toBe(true);
    expect(screen.getByText("$1.05")).toBeInTheDocument();
  });

  it("triggers notification when currentPrice crosses the alert threshold", () => {
    const onAlertTriggered = vi.fn();
    // Render initially with price 0.10
    const { rerender } = render(
      <PriceAlertManager
        currentPrice={0.1}
        asset="XLM"
        onAlertTriggered={onAlertTriggered}
      />,
    );

    // Add an alert for price above 0.15
    const input = screen.getByTestId("alert-threshold-input");
    fireEvent.change(input, { target: { value: "0.15" } });
    fireEvent.click(screen.getByTestId("create-alert-button"));

    // Now price moves up to 0.16 (crossing threshold)
    rerender(
      <PriceAlertManager
        currentPrice={0.16}
        asset="XLM"
        onAlertTriggered={onAlertTriggered}
      />,
    );

    // Notification banner should be visible
    expect(screen.getByTestId("price-alert-notification")).toBeInTheDocument();
    expect(screen.getByText(/crossed threshold above 0.15/i)).toBeInTheDocument();
    expect(onAlertTriggered).toHaveBeenCalledWith(
      expect.objectContaining({
        asset: "XLM",
        condition: "above",
        threshold: 0.15,
        triggerPrice: 0.16,
      }),
    );

    // Triggered alert should be logged in history
    const history = loadPriceAlertHistory();
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0].threshold).toBe(0.15);
  });

  it("displays alert history and allows clearing history", () => {
    localStorage.setItem(
      "sorokit:price-alert-history",
      JSON.stringify([
        {
          id: "hist-1",
          alertId: "alert-1",
          asset: "XLM",
          condition: "above",
          threshold: 0.12,
          triggerPrice: 0.125,
          triggeredAt: Date.now(),
        },
      ]),
    );

    render(<PriceAlertManager currentPrice={0.1} asset="XLM" />);

    expect(screen.getByTestId("alert-history")).toBeInTheDocument();
    expect(screen.getByText(/Triggered at \$0.1250/i)).toBeInTheDocument();

    const clearBtn = screen.getByTestId("clear-alert-history-button");
    fireEvent.click(clearBtn);

    expect(loadPriceAlertHistory()).toEqual([]);
    expect(screen.getByText(/No alerts have been triggered yet/i)).toBeInTheDocument();
  });
});
