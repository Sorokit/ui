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
    fireEvent.click(screen.getByRole("button", { name: "Distribute Evenly" }));

    const updated = onChange.mock.calls[0][0] as Record<string, number>;
    const total = Object.values(updated).reduce((sum, n) => sum + n, 0);
    expect(total).toBeCloseTo(100, 5);
  });

  it("equalises exactly for seven assets (no float drift)", () => {
    const seven = Array.from({ length: 7 }, (_, i) => asset(`A${i}`, 100 / 7));
    const onChange = vi.fn();
    render(<AllocationInput assets={seven} targets={{}} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Distribute Evenly" }));

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
  // ─── Issue #918 ─────────────────────────────────────────────────────────────
  describe("invalid total highlighting (issue #918)", () => {
    function inputs() {
      return ASSETS.map((a) => screen.getByLabelText(`Target allocation for ${a.assetCode}`));
    }

    it("flags every row when the total is under 100%", () => {
      render(
        <AllocationInput assets={ASSETS} targets={{ XLM: 50, USDC: 20 }} onChange={vi.fn()} />,
      );

      const message = screen.getByText(/total allocation must equal 100%/i);
      for (const input of inputs()) {
        expect(input).toHaveAttribute("aria-invalid", "true");
        expect(input).toHaveAttribute("aria-describedby", message.id);
        expect(input.className).toContain("border-red");
      }
      for (const a of ASSETS) {
        expect(screen.getByTestId(`allocation-row-error-${a.assetCode}`)).toHaveTextContent("!");
      }
    });

    it("flags every row when the total is over 100%", () => {
      render(
        <AllocationInput assets={ASSETS} targets={{ XLM: 80, USDC: 40 }} onChange={vi.fn()} />,
      );

      const alert = screen.getByRole("alert");
      for (const input of inputs()) {
        expect(input).toHaveAttribute("aria-invalid", "true");
        expect(input).toHaveAttribute("aria-describedby", alert.id);
      }
    });

    it("clears the highlight once the total is exactly 100%", () => {
      render(
        <AllocationInput
          assets={ASSETS}
          targets={{ XLM: 60, USDC: 30, BTC: 10 }}
          onChange={vi.fn()}
        />,
      );

      for (const input of inputs()) {
        expect(input).not.toHaveAttribute("aria-invalid");
        expect(input).not.toHaveAttribute("aria-describedby");
        expect(input.className).not.toContain("border-red");
      }
      expect(screen.queryByText(/total allocation must equal 100%/i)).not.toBeInTheDocument();
      for (const a of ASSETS) {
        expect(screen.getByTestId(`allocation-row-error-${a.assetCode}`)).toBeEmptyDOMElement();
      }
    });

    it("does not flag an untouched form", () => {
      render(<AllocationInput assets={ASSETS} targets={{}} onChange={vi.fn()} />);
      for (const input of inputs()) {
        expect(input).not.toHaveAttribute("aria-invalid");
      }
    });
  });

  describe("arrow-key stepping (issue #918)", () => {
    it("sets a 0.1 step on every input", () => {
      render(<AllocationInput assets={ASSETS} targets={{}} onChange={vi.fn()} />);
      for (const a of ASSETS) {
        expect(screen.getByLabelText(`Target allocation for ${a.assetCode}`)).toHaveAttribute(
          "step",
          "0.1",
        );
      }
    });

    it("increments by 0.1% on ArrowUp", () => {
      const onChange = vi.fn();
      render(
        <AllocationInput assets={ASSETS} targets={{ XLM: 50, USDC: 50 }} onChange={onChange} />,
      );
      fireEvent.keyDown(screen.getByLabelText("Target allocation for XLM"), { key: "ArrowUp" });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).toEqual({ XLM: 50.1, USDC: 50 });
    });

    it("decrements by 0.1% on ArrowDown", () => {
      const onChange = vi.fn();
      render(<AllocationInput assets={ASSETS} targets={{ XLM: 50 }} onChange={onChange} />);
      fireEvent.keyDown(screen.getByLabelText("Target allocation for XLM"), { key: "ArrowDown" });

      expect(onChange.mock.calls[0][0].XLM).toBe(49.9);
    });

    it("steps without floating-point drift", () => {
      const onChange = vi.fn();
      render(<AllocationInput assets={ASSETS} targets={{ XLM: 0.2 }} onChange={onChange} />);
      fireEvent.keyDown(screen.getByLabelText("Target allocation for XLM"), { key: "ArrowUp" });

      expect(onChange.mock.calls[0][0].XLM).toBe(0.3);
    });

    it("steps from the value currently being typed", () => {
      const onChange = vi.fn();
      render(<AllocationInput assets={ASSETS} targets={{ XLM: 10 }} onChange={onChange} />);
      const input = screen.getByLabelText("Target allocation for XLM");
      fireEvent.change(input, { target: { value: "12.5" } });
      fireEvent.keyDown(input, { key: "ArrowUp" });

      expect(onChange.mock.calls.at(-1)?.[0].XLM).toBe(12.6);
    });

    it("clamps to the 0–100 range", () => {
      const onChange = vi.fn();
      render(
        <AllocationInput assets={ASSETS} targets={{ XLM: 100, USDC: 0 }} onChange={onChange} />,
      );
      fireEvent.keyDown(screen.getByLabelText("Target allocation for XLM"), { key: "ArrowUp" });
      fireEvent.keyDown(screen.getByLabelText("Target allocation for USDC"), { key: "ArrowDown" });

      expect(onChange.mock.calls[0][0].XLM).toBe(100);
      expect(onChange.mock.calls[1][0].USDC).toBe(0);
    });

    it("ignores other keys", () => {
      const onChange = vi.fn();
      render(<AllocationInput assets={ASSETS} targets={{ XLM: 50 }} onChange={onChange} />);
      fireEvent.keyDown(screen.getByLabelText("Target allocation for XLM"), { key: "ArrowLeft" });
      fireEvent.keyDown(screen.getByLabelText("Target allocation for XLM"), { key: "Enter" });

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("Distribute Evenly (issue #918)", () => {
    function distribute(assets: PortfolioAsset[]) {
      const onChange = vi.fn();
      render(<AllocationInput assets={assets} targets={{}} onChange={onChange} />);
      fireEvent.click(screen.getByRole("button", { name: "Distribute Evenly" }));
      expect(onChange).toHaveBeenCalledTimes(1);
      return onChange.mock.calls[0][0] as Record<string, number>;
    }

    it("splits 100% evenly when it divides cleanly", () => {
      expect(distribute([asset("XLM", 70), asset("USDC", 30)])).toEqual({ XLM: 50, USDC: 50 });
    });

    it("gives a single asset the full 100%", () => {
      expect(distribute([asset("XLM", 100)])).toEqual({ XLM: 100 });
    });

    it("hands the remainder to the largest current holding", () => {
      // 100 / 3 = 33.333…, so one asset takes the leftover cent.
      expect(distribute(ASSETS)).toEqual({ XLM: 33.34, USDC: 33.33, BTC: 33.33 });
    });

    it("spreads a multi-cent remainder one cent at a time", () => {
      const six = [
        asset("A", 30),
        asset("B", 25),
        asset("C", 20),
        asset("D", 15),
        asset("E", 6),
        asset("F", 4),
      ];
      // 100 / 6 = 16.666…, floored to 16.66 → 4 cents left for A–D.
      expect(distribute(six)).toEqual({
        A: 16.67,
        B: 16.67,
        C: 16.67,
        D: 16.67,
        E: 16.66,
        F: 16.66,
      });
    });

    it("discards in-progress typing when distributing", () => {
      const onChange = vi.fn();
      render(<AllocationInput assets={ASSETS} targets={{}} onChange={onChange} />);
      const input = screen.getByLabelText("Target allocation for XLM");
      fireEvent.change(input, { target: { value: "7" } });
      fireEvent.click(screen.getByRole("button", { name: "Distribute Evenly" }));

      expect(input).toHaveValue(null);
      expect(onChange.mock.calls.at(-1)?.[0]).toEqual({ XLM: 33.34, USDC: 33.33, BTC: 33.33 });
    });

    it("is disabled when the input is disabled", () => {
      render(<AllocationInput assets={ASSETS} targets={{}} onChange={vi.fn()} disabled />);
      expect(screen.getByRole("button", { name: "Distribute Evenly" })).toBeDisabled();
    });
  });
});
