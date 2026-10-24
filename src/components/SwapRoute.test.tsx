import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SwapSuggestion } from "@/lib/rebalancer";

import {
  detectCircularRoutes,
  isCircularRoute,
  SwapRoute,
  validateSwapRoute,
} from "./SwapRoute";

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

    expect(screen.getByText("deadbeef")).toBeInTheDocument();
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

  // ─── Issues #739, #870 acceptance criteria ───────────────────────────────────
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

  // ─── Issue #922 acceptance criteria ─────────────────────────────────────────

  describe("Multi-hop routes with fee tiers and liquidity depth (Issue #922)", () => {
    it("displays fee tiers and pool liquidity depth for intermediate hops", () => {
      const multiHopSwap: SwapSuggestion = {
        ...SWAP,
        from: "XLM",
        to: "BTC",
        hops: [
          {
            asset: "USDC",
            feeTier: "0.3%",
            liquidityDepth: "$1.2M",
          },
        ],
      };

      render(<SwapRoute swaps={[multiHopSwap]} />);

      // Asset pills for source, intermediate hop, and destination
      expect(screen.getAllByText("XLM").length).toBeGreaterThan(0);
      expect(screen.getAllByText("USDC").length).toBeGreaterThan(0);
      expect(screen.getAllByText("BTC").length).toBeGreaterThan(0);

      // Fee tier badge for intermediate hop
      expect(screen.getByText("0.3%")).toBeInTheDocument();
      expect(screen.getByTestId("fee-tier-badge")).toHaveTextContent("0.3%");

      // Pool liquidity depth indicator
      expect(screen.getByText("$1.2M")).toBeInTheDocument();
      expect(screen.getByTestId("liquidity-indicator")).toHaveTextContent("$1.2M");
    });

    it("displays multiple intermediate hops with their respective fee tiers and depths", () => {
      const twoHopSwap: SwapSuggestion = {
        ...SWAP,
        from: "XLM",
        to: "BTC",
        hops: [
          { asset: "USDC", feeTier: 0.05, poolDepth: 500000 },
          { asset: "EURC", feeTier: "0.3%", liquidityDepth: "$2.5M" },
        ],
      };

      render(<SwapRoute swaps={[twoHopSwap]} />);

      // Both intermediate nodes rendered
      expect(screen.getAllByTestId("intermediate-hop-node")).toHaveLength(2);
      expect(screen.getByText("0.05%")).toBeInTheDocument();
      expect(screen.getByText("$500k")).toBeInTheDocument();
      expect(screen.getByText("0.3%")).toBeInTheDocument();
      expect(screen.getByText("$2.5M")).toBeInTheDocument();
    });

    it("renders responsive vertical arrow connectors for small viewports (<640px) and horizontal connectors for desktop", () => {
      const multiHopSwap: SwapSuggestion = {
        ...SWAP,
        from: "XLM",
        to: "BTC",
        hops: [{ asset: "USDC", feeTier: "0.3%", liquidityDepth: "$1.2M" }],
      };

      render(<SwapRoute swaps={[multiHopSwap]} />);

      const connectors = screen.getAllByTestId("route-connector");
      // 2 connectors: XLM -> USDC and USDC -> BTC
      expect(connectors).toHaveLength(2);

      // Verify vertical connectors (block sm:hidden) for mobile viewports under 640px
      const verticalConnectors = screen.getAllByTestId("vertical-connector");
      expect(verticalConnectors).toHaveLength(2);
      verticalConnectors.forEach((vc) => {
        expect(vc).toHaveClass("block");
        expect(vc).toHaveClass("sm:hidden");
      });

      // Verify horizontal connectors (hidden sm:block) for desktop viewports
      const horizontalConnectors = screen.getAllByTestId("horizontal-connector");
      expect(horizontalConnectors).toHaveLength(2);
      horizontalConnectors.forEach((hc) => {
        expect(hc).toHaveClass("hidden");
        expect(hc).toHaveClass("sm:block");
      });
    });
  });

  describe("Circular route detection and rejection (Issue #922)", () => {
    it("detects circular multi-hop route (e.g. XLM -> USDC -> XLM)", () => {
      const circularSwap: SwapSuggestion = {
        ...SWAP,
        from: "XLM",
        to: "XLM",
        hops: [{ asset: "USDC", feeTier: "0.3%", liquidityDepth: "$1.2M" }],
      };

      expect(isCircularRoute(circularSwap)).toBe(true);

      const validation = validateSwapRoute(circularSwap);
      expect(validation.isValid).toBe(false);
      expect(validation.isCircular).toBe(true);
      expect(validation.error).toMatch(/circular route rejected/i);
      expect(validation.path).toEqual(["XLM", "USDC", "XLM"]);
    });

    it("detects circular route when destination matches origin directly (e.g. XLM -> XLM)", () => {
      const directCircularSwap: SwapSuggestion = {
        ...SWAP,
        from: "XLM",
        to: "XLM",
      };

      expect(isCircularRoute(directCircularSwap)).toBe(true);
      expect(validateSwapRoute(directCircularSwap).isValid).toBe(false);
    });

    it("detects circular route defined via path array (e.g. ['XLM', 'USDC', 'XLM'])", () => {
      expect(isCircularRoute(["XLM", "USDC", "XLM"])).toBe(true);
      expect(isCircularRoute(["XLM", "USDC", "BTC"])).toBe(false);

      const pathSwap: SwapSuggestion = {
        ...SWAP,
        from: "XLM",
        to: "BTC",
        path: ["XLM", "USDC", "XLM", "BTC"],
      };
      expect(isCircularRoute(pathSwap)).toBe(true);
    });

    it("detects circular cycles across multiple swaps (e.g. XLM -> USDC and USDC -> XLM)", () => {
      const swap1: SwapSuggestion = { ...SWAP, from: "XLM", to: "USDC" };
      const swap2: SwapSuggestion = { ...SWAP, from: "USDC", to: "XLM" };

      const cycleResult = detectCircularRoutes([swap1, swap2]);
      expect(cycleResult.hasCycle).toBe(true);
      expect(cycleResult.circularIndices).toContain(0);
      expect(cycleResult.circularIndices).toContain(1);
    });

    it("validates that a valid non-circular route is accepted", () => {
      const validSwap: SwapSuggestion = {
        ...SWAP,
        from: "XLM",
        to: "BTC",
        hops: [{ asset: "USDC", feeTier: "0.3%", liquidityDepth: "$1.2M" }],
      };

      expect(isCircularRoute(validSwap)).toBe(false);
      const validation = validateSwapRoute(validSwap);
      expect(validation.isValid).toBe(true);
      expect(validation.isCircular).toBe(false);
      expect(validation.error).toBeUndefined();
    });

    it("rejects circular routes in the UI by displaying rejection banner and rejected badge", () => {
      const circularSwap: SwapSuggestion = {
        ...SWAP,
        from: "XLM",
        to: "XLM",
        hops: [{ asset: "USDC", feeTier: "0.3%", liquidityDepth: "$1.2M" }],
      };

      render(<SwapRoute swaps={[circularSwap]} statuses={["success"]} />);

      // Alert banner is rendered
      expect(screen.getByRole("alert")).toHaveTextContent(/circular route detected and rejected/i);

      // Badge displays "Rejected" rather than "Done"
      expect(screen.getByText("Rejected")).toBeInTheDocument();
      expect(screen.queryByText("Done")).not.toBeInTheDocument();

      // Error message explains circular route rejection
      expect(screen.getByText(/circular route rejected.*XLM.*USDC.*XLM/i)).toBeInTheDocument();

      // Row aria-label marks circular route as rejected
      expect(
        screen.getByRole("listitem", { name: /circular route rejected/i }),
      ).toBeInTheDocument();
    });
  });
});

