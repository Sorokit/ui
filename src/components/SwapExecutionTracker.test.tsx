import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SwapExecutionTracker } from "./SwapExecutionTracker";

describe("SwapExecutionTracker", () => {
  it("renders execution metrics, explorer link, and a warning when slippage exceeds threshold", () => {
    render(
      <SwapExecutionTracker
        swap={{
          from: "XLM",
          to: "USDC",
          fromAmount: 1000,
          toAmountExpected: 95,
          slippagePct: 0.3,
          feeStroops: 100,
          swapFeePct: 0.3,
          totalCostUsd: 1.2,
        }}
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
});
