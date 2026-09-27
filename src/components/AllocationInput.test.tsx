import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PortfolioAsset } from "@/lib/rebalancer";

import { AllocationInput } from "./AllocationInput";

function asset(assetCode: string, currentPct: number): PortfolioAsset {
  return {
    asset: assetCode,
    assetCode,
    balance: "100",
    usdValue: 100,
    currentPct,
  };
}

const ASSETS: PortfolioAsset[] = [
  asset("XLM", 60),
  asset("USDC", 30),
  asset("BTC", 10),
];

describe("AllocationInput", () => {
  it("does not commit 0 when the input is cleared", () => {
    const onChange = vi.fn();
    render(
      <AllocationInput assets={ASSETS} targets={{ XLM: 50 }} onChange={onChange} />,
    );

    const input = screen.getByLabelText("Target allocation for XLM");
    fireEvent.change(input, { target: { value: "" } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].XLM).toBe(0);
  });

  it("equalises to exactly 100.00 across asset counts", () => {
    const onChange = vi.fn();
    render(
      <AllocationInput assets={ASSETS} targets={{}} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Equalise" }));

    const updated = onChange.mock.calls[0][0] as Record<string, number>;
    const total = Object.values(updated).reduce((sum, n) => sum + n, 0);
    expect(total).toBeCloseTo(100, 5);
  });

  it("equalises exactly for seven assets (no float drift)", () => {
    const seven = Array.from({ length: 7 }, (_, i) => asset(`A${i}`, 100 / 7));
    const onChange = vi.fn();
    render(<AllocationInput assets={seven} targets={{}} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Equalise" }));

    const updated = onChange.mock.calls[0][0] as Record<string, number>;
    const total = Object.values(updated).reduce((sum, n) => sum + n, 0);
    expect(Number(total.toFixed(2))).toBe(100);
  });

  it("shows an over-allocation alert when targets exceed 100%", () => {
    render(
      <AllocationInput assets={ASSETS} targets={{ XLM: 80, USDC: 40 }} onChange={vi.fn()} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/exceeds 100%/i);
  });

  // ─── Issue #740 acceptance criteria ─────────────────────────────────────────
  // Note: AllocationInput is a multi-asset percentage editor keyed by asset
  // code (not a single number field). These cases exercise the per-asset
  // numeric input against the issue's criteria: initial value, 0–100 clamping,
  // and the onChange payload on valid input.
  describe("percentage input (issue #740)", () => {
    it("renders each input with its initial target value", () => {
      render(
        <AllocationInput
          assets={ASSETS}
          targets={{ XLM: 60, USDC: 30, BTC: 10 }}
          onChange={vi.fn()}
        />,
      );

      expect(screen.getByLabelText("Target allocation for XLM")).toHaveValue(60);
      expect(screen.getByLabelText("Target allocation for USDC")).toHaveValue(30);
      expect(screen.getByLabelText("Target allocation for BTC")).toHaveValue(10);
    });

    it("rejects values above 100 by clamping to 100", () => {
      const onChange = vi.fn();
      render(
        <AllocationInput assets={ASSETS} targets={{ XLM: 50 }} onChange={onChange} />,
      );

      const input = screen.getByLabelText("Target allocation for XLM");
      fireEvent.change(input, { target: { value: "150" } });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0].XLM).toBe(100);
    });

    it("rejects values below 0 by clamping to 0", () => {
      const onChange = vi.fn();
      render(
        <AllocationInput assets={ASSETS} targets={{ XLM: 50 }} onChange={onChange} />,
      );

      const input = screen.getByLabelText("Target allocation for XLM");
      fireEvent.change(input, { target: { value: "-5" } });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0].XLM).toBe(0);
    });

    it("calls onChange with the correct numeric value on valid input", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <AllocationInput assets={ASSETS} targets={{ XLM: 0 }} onChange={onChange} />,
      );

      const input = screen.getByLabelText("Target allocation for XLM");
      await user.type(input, "42");

      // Payload is a numeric map keyed by asset code, and the final committed
      // value matches what the user typed.
      const lastCall = onChange.mock.calls.at(-1)?.[0] as Record<string, number>;
      expect(lastCall.XLM).toBe(42);
      expect(typeof lastCall.XLM).toBe("number");
    });
  });
});
