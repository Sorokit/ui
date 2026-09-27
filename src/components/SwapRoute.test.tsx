import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SwapSuggestion } from "@/lib/rebalancer";

import { SwapRoute } from "./SwapRoute";

const SWAP: SwapSuggestion = {
  from: "XLM",
  to: "USDC",
  fromAmount: 10,
  toAmountExpected: 9.8,
  slippagePct: 0.5,
  feeStroops: 100,
  swapFeePct: 0.3,
  totalCostUsd: 0.12,
};

describe("SwapRoute", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("renders the empty state when there are no swaps", () => {
    render(<SwapRoute swaps={[]} />);
    expect(screen.getByText(/No swaps needed/i)).toBeInTheDocument();
  });

  it("renders safely when status/hash arrays are shorter than the swap list", () => {
    render(
      <SwapRoute
        swaps={[SWAP, { ...SWAP, to: "BTC" }]}
        statuses={["success"]}
        txHashes={[]}
        errors={[]}
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("shows a copy button and explorer link for a successful tx hash", () => {
    render(
      <SwapRoute swaps={[SWAP]} statuses={["success"]} txHashes={["deadbeef"]} />,
    );

    const link = screen.getByRole("link", { name: /view on explorer/i });
    expect(link).toHaveAttribute(
      "href",
      "https://stellar.expert/explorer/public/tx/deadbeef",
    );

    fireEvent.click(screen.getByRole("button", { name: /copy transaction hash/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("deadbeef");
  });

  it("renders pending, submitting and failed states", () => {
    render(
      <SwapRoute
        swaps={[SWAP, { ...SWAP, to: "BTC" }, { ...SWAP, to: "ETH" }]}
        statuses={["pending", "submitting", "failed"]}
        errors={[null, null, "boom"]}
      />,
    );

    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  // ─── Issue #739 acceptance criteria ─────────────────────────────────────────
  it("renders the suggestion list with each swap's assets and amounts", () => {
    render(<SwapRoute swaps={[SWAP, { ...SWAP, from: "USDC", to: "BTC" }]} />);

    // One list row per suggestion.
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    // Header reflects the number of swaps.
    expect(screen.getByText(/2 swaps to reach target/i)).toBeInTheDocument();
    // Asset codes rendered for each leg of the route.
    expect(screen.getAllByText("XLM").length).toBeGreaterThan(0);
    expect(screen.getAllByText("USDC").length).toBeGreaterThan(0);
    expect(screen.getAllByText("BTC").length).toBeGreaterThan(0);
  });

  it("shows the error message for a failed swap", () => {
    render(
      <SwapRoute
        swaps={[SWAP]}
        statuses={["failed"]}
        errors={["Insufficient liquidity"]}
      />,
    );

    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Insufficient liquidity")).toBeInTheDocument();
  });

  it("formats the slippage percentage correctly", () => {
    // slippagePct: 0.5 → formatPct → "0.50%" (distinct from the 0.30% swap fee).
    render(<SwapRoute swaps={[SWAP]} />);

    expect(screen.getByText("Slippage")).toBeInTheDocument();
    // Appears on the row metric and again in the weighted-average footer cell.
    expect(screen.getAllByText("0.50%").length).toBeGreaterThan(0);
    // The swap fee uses a different format so the two are not conflated.
    expect(screen.getByText("0.30%")).toBeInTheDocument();
  });
});
