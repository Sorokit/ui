import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SwapExecutionTracker } from "./SwapExecutionTracker";

describe("SwapExecutionTracker", () => {
  const dummySwap = {
    from: "XLM",
    to: "USDC",
    fromAmount: 1000,
    toAmountExpected: 95,
    slippagePct: 0.3,
    feeStroops: 100,
    swapFeePct: 0.3,
    totalCostUsd: 1.2,
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders execution metrics, explorer link, and a warning when slippage exceeds threshold", () => {
    render(
      <SwapExecutionTracker
        swap={dummySwap}
        txHash="tx123"
        executedAt="2026-07-26T12:00:00.000Z"
        actualOutput={90}
        slippageThresholdPct={0.2}
      />,
    );

    expect(screen.getByText(/source/i)).toBeInTheDocument();
    expect(screen.getByText(/1,000 XLM/i)).toBeInTheDocument();
    expect(screen.getByText(/^XLM$/i)).toBeInTheDocument();
    expect(screen.getByText(/destination/i)).toBeInTheDocument();
    expect(screen.getAllByText(/90 USDC/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/^USDC$/i)).toBeInTheDocument();
    expect(screen.getByText(/price impact/i)).toBeInTheDocument();
    expect(screen.getByText(/0.30%/i)).toBeInTheDocument();
    expect(screen.getByText(/warning: slippage exceeded threshold/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view on explorer/i })).toHaveAttribute("href", expect.stringContaining("tx123"));
  });

  it("renders submitted state with step progression and initial countdown timer", () => {
    render(
      <SwapExecutionTracker
        swap={dummySwap}
        status="submitted"
        timeoutSeconds={60}
      />,
    );

    expect(screen.getAllByText(/submitted/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Confirming \(60s\)/i)).toBeInTheDocument();
  });

  it("renders confirming state with active status badge", () => {
    render(
      <SwapExecutionTracker
        swap={dummySwap}
        txHash="tx999"
        status="confirming"
      />,
    );

    expect(screen.getByText("Confirming...")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view on explorer/i })).toHaveAttribute("href", expect.stringContaining("tx999"));
  });

  it("renders timeout error state with alert banner, check explorer link, and retry option", () => {
    const onRetry = vi.fn();
    render(
      <SwapExecutionTracker
        swap={dummySwap}
        txHash="tx_dropped_123"
        status="timeout"
        timeoutSeconds={60}
        onRetry={onRetry}
      />,
    );

    expect(screen.getAllByText(/transaction timed out/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/was not confirmed within 60 seconds/i)).toBeInTheDocument();

    const checkExplorerLink = screen.getByRole("link", { name: /check explorer for transaction/i });
    expect(checkExplorerLink).toHaveAttribute("href", expect.stringContaining("tx_dropped_123"));

    const retryButton = screen.getByRole("button", { name: /retry swap/i });
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("automatically transitions to timeout state when timer elapses in confirming state", () => {
    render(
      <SwapExecutionTracker
        swap={dummySwap}
        txHash="tx_pending_456"
        status="confirming"
        timeoutSeconds={5}
      />,
    );

    expect(screen.getByText("Confirming...")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    // Advance timer past the 5-second limit
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getAllByText(/transaction timed out/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /check explorer for transaction/i })).toHaveAttribute("href", expect.stringContaining("tx_pending_456"));
  });
});

