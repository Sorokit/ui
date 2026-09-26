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
});
