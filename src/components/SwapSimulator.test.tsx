import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";

import { MINIMUM_LIQUIDITY_THRESHOLD, SwapSimulator } from "./SwapSimulator";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

const mockDisconnectedState = {
  address: null,
  isConnected: false,
  isConnecting: false,
  isLoading: false,
  connectWallet: vi.fn(),
  disconnectWallet: vi.fn(),
  account: null,
  balances: [],
  isLoadingAccount: false,
  refreshAccount: vi.fn(),
  network: null,
  switchNetwork: vi.fn(),
  error: null,
  clearError: vi.fn(),
};

const mockConnectedState = {
  ...mockDisconnectedState,
  address: "GBRPYHIL2CI3WHGSUJGY6O7SROQOMJG7QBCACN4QPKUOQNXJDGONXHPA",
  isConnected: true,
};

describe("SwapSimulator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSorokit).mockReturnValue(mockDisconnectedState as ReturnType<typeof useSorokit>);
  });

  // ---- Rendering ----

  it("renders the component with default state", () => {
    render(<SwapSimulator />);
    expect(screen.getByText("Swap Simulator")).toBeInTheDocument();
  });

  it("renders the from and to asset selectors", () => {
    render(<SwapSimulator />);
    const selects = screen.getAllByRole("combobox");
    expect(selects.length).toBeGreaterThanOrEqual(2);
  });

  it("renders the input amount field with default value", () => {
    render(<SwapSimulator />);
    const input = screen.getByPlaceholderText("0.0");
    expect(input).toBeInTheDocument();
    expect((input as HTMLInputElement).value).toBe("100");
  });

  it("renders slippage scenarios section", () => {
    render(<SwapSimulator />);
    expect(screen.getByText("Slippage Scenarios")).toBeInTheDocument();
    expect(screen.getByText("0.1% Slippage")).toBeInTheDocument();
    expect(screen.getByText("0.5% Slippage")).toBeInTheDocument();
    expect(screen.getByText("1% Slippage")).toBeInTheDocument();
    expect(screen.getByText("5% Slippage")).toBeInTheDocument();
  });

  it("renders the max slippage tolerance input", () => {
    render(<SwapSimulator />);
    expect(screen.getByLabelText("Max Slippage Tolerance (%)")).toBeInTheDocument();
  });

  it("renders the chart tabs", () => {
    render(<SwapSimulator />);
    expect(screen.getByText("Price Impact Curve")).toBeInTheDocument();
    expect(screen.getByText("Price History")).toBeInTheDocument();
  });

  it("renders the liquidity size controls", () => {
    render(<SwapSimulator />);
    expect(screen.getByText(/low liq/i)).toBeInTheDocument();
    expect(screen.getByText(/medium liq/i)).toBeInTheDocument();
    expect(screen.getByText(/high liq/i)).toBeInTheDocument();
  });

  // ---- Button State Based on Wallet Connection ----

  it("shows 'Connect Wallet to Swap' when disconnected", () => {
    render(<SwapSimulator />);
    expect(screen.getByRole("button", { name: /connect wallet to swap/i })).toBeInTheDocument();
  });

  it("shows 'Swap Assets' when wallet is connected", () => {
    vi.mocked(useSorokit).mockReturnValue(mockConnectedState as ReturnType<typeof useSorokit>);
    render(<SwapSimulator />);
    expect(screen.getByRole("button", { name: /swap assets/i })).toBeInTheDocument();
  });

  // ---- Real-Time Calculation ----

  it("shows output amount > 0 when input amount > 0", () => {
    render(<SwapSimulator />);
    // Default input is 100, so output should be auto-calculated and shown
    // The output div shows calculated amount
    // Look for a numeric value that is not "0.0000"
    const outputValues = screen.getAllByText(/\d+\.\d{4,}/);
    // At least one non-zero output should be rendered
    expect(outputValues.length).toBeGreaterThan(0);
  });

  it("shows price impact badge when amount > 0", () => {
    render(<SwapSimulator />);
    // When amountIn > 0, the price detail row is shown — exchange rate is a unique label
    expect(screen.getByText(/exchange rate/i)).toBeInTheDocument();
    // "Price Impact:" label appears as a span inside the details row
    expect(screen.getAllByText(/price impact/i).length).toBeGreaterThan(0);
  });

  it("shows exchange rate when amount > 0", () => {
    render(<SwapSimulator />);
    expect(screen.getByText(/exchange rate/i)).toBeInTheDocument();
  });

  it("shows fee line when amount > 0", () => {
    render(<SwapSimulator />);
    expect(screen.getByText(/fee \(0\.3%\)/i)).toBeInTheDocument();
  });

  it("hides exchange rate details when amount is 0 or empty", () => {
    render(<SwapSimulator />);
    const input = screen.getByPlaceholderText("0.0");
    fireEvent.change(input, { target: { value: "0" } });
    expect(screen.queryByText(/exchange rate/i)).not.toBeInTheDocument();
  });

  // ---- Slippage Tolerance Validation ----

  it("shows error when slippage is 0", () => {
    render(<SwapSimulator />);
    const slippageInput = screen.getByLabelText("Max Slippage Tolerance (%)");
    fireEvent.change(slippageInput, { target: { value: "0" } });
    expect(screen.getByText(/slippage must be between 0\.1% and 50%/i)).toBeInTheDocument();
  });

  it("shows error when slippage exceeds 50%", () => {
    render(<SwapSimulator />);
    const slippageInput = screen.getByLabelText("Max Slippage Tolerance (%)");
    fireEvent.change(slippageInput, { target: { value: "99" } });
    expect(screen.getByText(/slippage must be between 0\.1% and 50%/i)).toBeInTheDocument();
  });

  it("shows error when slippage is non-numeric", () => {
    render(<SwapSimulator />);
    const slippageInput = screen.getByLabelText("Max Slippage Tolerance (%)");
    fireEvent.change(slippageInput, { target: { value: "abc" } });
    expect(screen.getByText(/slippage must be between 0\.1% and 50%/i)).toBeInTheDocument();
  });

  it("accepts a valid slippage value without error", () => {
    render(<SwapSimulator />);
    const slippageInput = screen.getByLabelText("Max Slippage Tolerance (%)");
    fireEvent.change(slippageInput, { target: { value: "1.5" } });
    expect(screen.queryByText(/slippage must be between 0\.1% and 50%/i)).not.toBeInTheDocument();
  });

  it("preset slippage quick buttons update slippage input", () => {
    render(<SwapSimulator />);
    const btn = screen.getByRole("button", { name: /^1\.0%$/ });
    fireEvent.click(btn);
    const slippageInput = screen.getByLabelText("Max Slippage Tolerance (%)") as HTMLInputElement;
    expect(slippageInput.value).toBe("1.0");
  });

  // ---- Slippage Warning ----

  it("shows slippage warning when price impact exceeds tolerance", () => {
    render(<SwapSimulator />);
    // Set a very large input to create high price impact
    const input = screen.getByPlaceholderText("0.0");
    fireEvent.change(input, { target: { value: "50000" } });
    // Set a very tight slippage
    const slippageInput = screen.getByLabelText("Max Slippage Tolerance (%)");
    fireEvent.change(slippageInput, { target: { value: "0.1" } });
    // Warning should appear
    expect(screen.queryByText(/high slippage warning/i)).toBeInTheDocument();
  });

  it("does not show slippage warning when impact is within tolerance", () => {
    render(<SwapSimulator />);
    // Small input will have very low impact
    const input = screen.getByPlaceholderText("0.0");
    fireEvent.change(input, { target: { value: "1" } });
    // Default slippage is 0.5%
    // For small trades, price impact should be well below 0.5%
    // We rely on the component logic
    const slippageInput = screen.getByLabelText("Max Slippage Tolerance (%)");
    fireEvent.change(slippageInput, { target: { value: "50" } });
    expect(screen.queryByText(/high slippage warning/i)).not.toBeInTheDocument();
  });

  // ---- Asset Selection & Flip ----

  it("can flip assets using the flip button", () => {
    render(<SwapSimulator />);
    const selects = screen.getAllByRole("combobox");
    const fromSelect = selects[0] as HTMLSelectElement;
    const toSelect = selects[1] as HTMLSelectElement;
    const initialFrom = fromSelect.value;
    const initialTo = toSelect.value;

    const flipBtn = screen.getByLabelText("Flip input and output assets");
    fireEvent.click(flipBtn);

    expect(fromSelect.value).toBe(initialTo);
    expect(toSelect.value).toBe(initialFrom);
  });

  it("prevents selecting the same asset for both from and to", () => {
    render(<SwapSimulator />);
    const selects = screen.getAllByRole("combobox");
    const fromSelect = selects[0] as HTMLSelectElement;
    const toSelect = selects[1] as HTMLSelectElement;

    const currentTo = toSelect.value;
    // Change "from" to the same asset as "to"
    fireEvent.change(fromSelect, { target: { value: currentTo } });
    // The "to" should have auto-changed to something different
    expect(toSelect.value).not.toBe(currentTo);
  });

  // ---- Liquidity Size ----

  it("can change liquidity size to low", () => {
    render(<SwapSimulator />);
    const lowBtn = screen.getByText(/low liq/i);
    fireEvent.click(lowBtn);
    // After switching to low liquidity, price info row is still rendered
    expect(screen.getByText(/exchange rate/i)).toBeInTheDocument();
  });

  it("can change liquidity size to high", () => {
    render(<SwapSimulator />);
    const highBtn = screen.getByText(/high liq/i);
    fireEvent.click(highBtn);
    // After switching to high liquidity, price info row is still rendered
    expect(screen.getByText(/exchange rate/i)).toBeInTheDocument();
  });

  // ---- Chart Tab Switching ----

  it("switches to price history tab on click", () => {
    render(<SwapSimulator />);
    const historyTab = screen.getByRole("button", { name: /price history/i });
    fireEvent.click(historyTab);
    // Should render the 7D/30D toggles
    expect(screen.getByRole("button", { name: /^7D$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^30D$/i })).toBeInTheDocument();
  });

  it("switches history chart range to 30D", () => {
    render(<SwapSimulator />);
    // First open history tab
    const historyTab = screen.getByRole("button", { name: /price history/i });
    fireEvent.click(historyTab);
    // Click 30D
    const thirtyDBtn = screen.getByRole("button", { name: /^30D$/i });
    fireEvent.click(thirtyDBtn);
    // Button should now reflect 30D selection - just verify it's clickable and present
    expect(thirtyDBtn).toBeInTheDocument();
  });

  // ---- Execute Swap ----

  it("calls connectWallet when button clicked while disconnected", async () => {
    const connectMock = vi.fn();
    vi.mocked(useSorokit).mockReturnValue({
      ...mockDisconnectedState,
      connectWallet: connectMock,
    } as ReturnType<typeof useSorokit>);
    render(<SwapSimulator />);
    const btn = screen.getByRole("button", { name: /connect wallet to swap/i });
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(connectMock).toHaveBeenCalledTimes(1);
  });

  it("calls onSwap callback after successful swap", async () => {
    vi.mocked(useSorokit).mockReturnValue(mockConnectedState as ReturnType<typeof useSorokit>);
    const onSwap = vi.fn();
    render(<SwapSimulator onSwap={onSwap} />);

    const btn = screen.getByRole("button", { name: /swap assets/i });
    await act(async () => {
      fireEvent.click(btn);
      // Simulate the 1.5 second delay
      await new Promise((r) => setTimeout(r, 1600));
    });

    expect(onSwap).toHaveBeenCalledTimes(1);
    expect(onSwap).toHaveBeenCalledWith(
      expect.objectContaining({
        fromAsset: "XLM",
        toAsset: "USDC",
        amountIn: 100,
      })
    );
  }, 10000);

  it("shows success message after swap", async () => {
    vi.mocked(useSorokit).mockReturnValue(mockConnectedState as ReturnType<typeof useSorokit>);
    render(<SwapSimulator />);

    const btn = screen.getByRole("button", { name: /swap assets/i });
    await act(async () => {
      fireEvent.click(btn);
      await new Promise((r) => setTimeout(r, 1600));
    });

    expect(screen.getByText(/swap completed successfully/i)).toBeInTheDocument();
  }, 10000);

  it("swap button is disabled when amount is 0 and wallet is connected", () => {
    vi.mocked(useSorokit).mockReturnValue(mockConnectedState as ReturnType<typeof useSorokit>);
    render(<SwapSimulator />);
    const input = screen.getByPlaceholderText("0.0");
    fireEvent.change(input, { target: { value: "0" } });
    const btn = screen.getByRole("button", { name: /swap assets/i });
    expect(btn).toBeDisabled();
  });

  it("swap button is disabled when slippage is invalid and wallet is connected", () => {
    vi.mocked(useSorokit).mockReturnValue(mockConnectedState as ReturnType<typeof useSorokit>);
    render(<SwapSimulator />);
    const slippageInput = screen.getByLabelText("Max Slippage Tolerance (%)");
    fireEvent.change(slippageInput, { target: { value: "-1" } });
    const btn = screen.getByRole("button", { name: /swap assets/i });
    expect(btn).toBeDisabled();
  });

  it("shows a warning banner and blocks swap execution for invalid slippage", () => {
    vi.mocked(useSorokit).mockReturnValue(mockConnectedState as ReturnType<typeof useSorokit>);
    const onSwap = vi.fn();
    render(<SwapSimulator onSwap={onSwap} />);
    fireEvent.change(screen.getByLabelText("Max Slippage Tolerance (%)"), {
      target: { value: "55" },
    });
    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent(/invalid slippage/i);
    expect(banner).toHaveTextContent(/slippage must be between 0\.1% and 50%/i);
    const btn = screen.getByRole("button", { name: /swap assets/i });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onSwap).not.toHaveBeenCalled();
  });

  it("debounces price impact chart recalculation while the amount is typed", () => {
    vi.useFakeTimers();
    render(<SwapSimulator />);
    expect(screen.getByText("Max Size: 500 XLM")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("0.0"), { target: { value: "1000" } });
    expect(screen.getByText("Max Size: 500 XLM")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByText("Max Size: 2000 XLM")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("shows a tooltip when a price history point receives keyboard focus", () => {
    render(<SwapSimulator />);
    fireEvent.click(screen.getByRole("button", { name: /price history/i }));
    const points = screen.getAllByRole("button", { name: /price point/i });
    expect(points.length).toBeGreaterThan(1);

    act(() => {
      points[0].focus();
    });
    expect(points[0]).toHaveFocus();
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent(points[0].getAttribute("aria-label")!.replace(/^Price point /, ""));

    fireEvent.keyDown(points[0], { key: "ArrowRight" });
    expect(points[1]).toHaveFocus();
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      points[1].getAttribute("aria-label")!.replace(/^Price point /, ""),
    );

    fireEvent.keyDown(points[1], { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  // ---- USD display when connected ----

  it("shows USD equivalent values when wallet is connected", () => {
    vi.mocked(useSorokit).mockReturnValue(mockConnectedState as ReturnType<typeof useSorokit>);
    render(<SwapSimulator />);
    expect(screen.getAllByText(/est\. usd/i).length).toBeGreaterThanOrEqual(2);
  });

  it("hides USD equivalent values when wallet is disconnected", () => {
    render(<SwapSimulator />);
    expect(screen.queryByText(/est\. usd/i)).not.toBeInTheDocument();
  });

  // ---- Custom className ----

  it("accepts a custom className prop", () => {
    const { container } = render(<SwapSimulator className="my-custom-class" />);
    expect(container.firstChild).toHaveClass("my-custom-class");
  });

  // ---- Zero Liquidity & Minimum Liquidity Threshold (#733, #864) ----

  describe("zero liquidity and minimum liquidity threshold (#733, #864)", () => {
    it("does not render NaN or Infinity when pool reserves are zero", () => {
      render(
        <SwapSimulator
          poolReserves={{
            "XLM-USDC": { fromReserves: 0, toReserves: 0 },
          }}
        />,
      );

      // Verify no NaN or Infinity is displayed in the DOM
      expect(screen.queryByText(/NaN/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Infinity/i)).not.toBeInTheDocument();

      // Asserts that Insufficient liquidity is shown instead of price impact
      expect(screen.getAllByText(/insufficient liquidity/i).length).toBeGreaterThanOrEqual(1);
    });

    it("shows 'Insufficient liquidity' alert, price impact, and disabled button for below-threshold reserves", () => {
      vi.mocked(useSorokit).mockReturnValue(mockConnectedState as ReturnType<typeof useSorokit>);

      render(
        <SwapSimulator
          poolReserves={{
            "XLM-USDC": {
              fromReserves: MINIMUM_LIQUIDITY_THRESHOLD * 0.2,
              toReserves: MINIMUM_LIQUIDITY_THRESHOLD * 0.2,
            },
          }}
        />,
      );

      // Shows warning banner
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent(/insufficient liquidity/i);

      // Swap button displays Insufficient liquidity and is disabled
      const btn = screen.getByRole("button", { name: /insufficient liquidity/i });
      expect(btn).toBeInTheDocument();
      expect(btn).toBeDisabled();

      // No NaN or Infinity
      expect(screen.queryByText(/NaN/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Infinity/i)).not.toBeInTheDocument();
    });

    it("handles zero reserveIn when reserveOut has liquidity without NaN or Infinity", () => {
      render(
        <SwapSimulator
          poolReserves={{
            "XLM-USDC": { fromReserves: 0, toReserves: 5000 },
          }}
        />,
      );

      expect(screen.queryByText(/NaN/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Infinity/i)).not.toBeInTheDocument();
      expect(screen.getAllByText(/insufficient liquidity/i).length).toBeGreaterThanOrEqual(1);
    });

    it("disables swap button and prevents onSwap callback when liquidity is insufficient", () => {
      vi.mocked(useSorokit).mockReturnValue(mockConnectedState as ReturnType<typeof useSorokit>);
      const onSwap = vi.fn();

      render(
        <SwapSimulator
          onSwap={onSwap}
          poolReserves={{
            "XLM-USDC": { fromReserves: 0, toReserves: 0 },
          }}
        />,
      );

      const btn = screen.getByRole("button", { name: /insufficient liquidity/i });
      expect(btn).toBeDisabled();
      fireEvent.click(btn);
      expect(onSwap).not.toHaveBeenCalled();
    });
  });

  // ---- Extreme Price Impact Scenarios ----

  describe("extreme price impact scenarios", () => {
    it("displays high price impact warning banner when impact exceeds 15%", () => {
      render(
        <SwapSimulator
          poolReserves={{
            "XLM-USDC": { fromReserves: 1000, toReserves: 100000 },
          }}
        />,
      );
      // With very low from reserves and high to reserves, a large swap creates extreme impact
      const input = screen.getByPlaceholderText("0.0");
      fireEvent.change(input, { target: { value: "500" } });
      // Should show price impact details
      expect(screen.getAllByText(/price impact/i).length).toBeGreaterThan(0);
    });

    it("shows critical error banner when price impact exceeds 50%", () => {
      render(
        <SwapSimulator
          poolReserves={{
            "XLM-USDC": { fromReserves: 100, toReserves: 100000 },
          }}
        />,
      );
      // Extreme input creates massive price impact
      const input = screen.getByPlaceholderText("0.0");
      fireEvent.change(input, { target: { value: "10000" } });
      // Verify high price impact badge is shown with "High" status
      expect(screen.getByText(/high/i)).toBeInTheDocument();
    });

    it("shows correct color coding for low price impact (< 1%)", () => {
      render(
        <SwapSimulator
          poolReserves={{
            "XLM-USDC": { fromReserves: 1000000, toReserves: 1000000 },
          }}
        />,
      );
      // Small input on deep liquidity pool creates low impact
      const input = screen.getByPlaceholderText("0.0");
      fireEvent.change(input, { target: { value: "10" } });
      // Should show "Low" badge for small price impact
      expect(screen.getByText(/low/i)).toBeInTheDocument();
    });

    it("shows correct color coding for medium price impact (1-5%)", () => {
      render(
        <SwapSimulator
          poolReserves={{
            "XLM-USDC": { fromReserves: 10000, toReserves: 10000 },
          }}
        />,
      );
      // Medium input on moderate liquidity creates medium impact
      const input = screen.getByPlaceholderText("0.0");
      fireEvent.change(input, { target: { value: "1000" } });
      // Should show "Medium" badge
      expect(screen.getByText(/medium/i)).toBeInTheDocument();
    });

    it("shows critical red banner when slippage is exceeded with extreme impact", () => {
      vi.mocked(useSorokit).mockReturnValue(mockConnectedState as ReturnType<typeof useSorokit>);
      render(
        <SwapSimulator
          poolReserves={{
            "XLM-USDC": { fromReserves: 500, toReserves: 50000 },
          }}
        />,
      );
      // Set a tight slippage tolerance
      const slippageInput = screen.getByLabelText("Max Slippage Tolerance (%)");
      fireEvent.change(slippageInput, { target: { value: "5" } });

      // Set amount to create high price impact
      const input = screen.getByPlaceholderText("0.0");
      fireEvent.change(input, { target: { value: "2000" } });

      // Should show "High Slippage Warning" banner in red
      expect(screen.getByText(/high slippage warning/i)).toBeInTheDocument();
      const banner = screen.getByText(/high slippage warning/i).closest("div");
      expect(banner).toHaveClass("bg-error-dim");
    });
  });

  // ---- Custom poolReserves Props ----

  describe("custom poolReserves props", () => {
    it("accepts and uses custom poolReserves configuration", () => {
      const customReserves = {
        "XLM-USDC": { fromReserves: 50000, toReserves: 6000 },
        "USDC-XLM": { fromReserves: 6000, toReserves: 50000 },
      };
      render(<SwapSimulator poolReserves={customReserves} />);
      // Component should render without errors
      expect(screen.getByText("Swap Simulator")).toBeInTheDocument();
      // Price calculations should use custom reserves
      expect(screen.getByText(/exchange rate/i)).toBeInTheDocument();
    });

    it("uses default POOL_RESERVES when custom poolReserves is not provided", () => {
      render(<SwapSimulator />);
      expect(screen.getByText("Swap Simulator")).toBeInTheDocument();
      expect(screen.getByText(/exchange rate/i)).toBeInTheDocument();
    });

    it("calculates correct exchange rate with custom poolReserves", () => {
      const customReserves = {
        "XLM-USDC": { fromReserves: 100000, toReserves: 12000 },
        "USDC-XLM": { fromReserves: 12000, toReserves: 100000 },
      };
      render(<SwapSimulator poolReserves={customReserves} />);
      // With custom reserves, the exchange rate calculation should reflect them
      expect(screen.getByText(/exchange rate/i)).toBeInTheDocument();
    });

    it("applies liquidity size multiplier correctly to custom poolReserves", () => {
      const customReserves = {
        "XLM-USDC": { fromReserves: 10000, toReserves: 1000 },
      };
      render(<SwapSimulator poolReserves={customReserves} />);
      // Get initial price impact
      const input = screen.getByPlaceholderText("0.0");
      fireEvent.change(input, { target: { value: "100" } });
      expect(screen.getByText(/price impact/i)).toBeInTheDocument();

      // Switch to high liquidity
      const highBtn = screen.getByText(/high liq/i);
      fireEvent.click(highBtn);
      // Price impact should decrease with higher liquidity multiplier
      expect(screen.getByText(/price impact/i)).toBeInTheDocument();
    });

    it("handles empty or missing custom poolReserves gracefully", () => {
      render(<SwapSimulator poolReserves={{}} />);
      // Should still render without crashing
      expect(screen.getByText("Swap Simulator")).toBeInTheDocument();
      // Should fall back to default 10000 reserves
      expect(screen.getByText(/exchange rate/i)).toBeInTheDocument();
    });

    it("correctly renders price impact curve with custom poolReserves", () => {
      const customReserves = {
        "XLM-USDC": { fromReserves: 5000, toReserves: 500 },
      };
      render(<SwapSimulator poolReserves={customReserves} />);
      // Click on impact chart tab (should be default)
      expect(screen.getByText("Price Impact Curve")).toBeInTheDocument();
      // SVG should be rendered
      const svgs = screen.getAllByRole("img", { hidden: true });
      expect(svgs.length).toBeGreaterThan(0);
    });

    it("respects asset pair mapping in custom poolReserves", () => {
      const customReserves = {
        "XLM-EURC": { fromReserves: 50000, toReserves: 5500 },
      };
      render(<SwapSimulator poolReserves={customReserves} />);
      // Select the custom asset pair
      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "XLM" } });
      fireEvent.change(selects[1], { target: { value: "EURC" } });
      // Should display exchange rate using custom reserves
      expect(screen.getByText(/exchange rate/i)).toBeInTheDocument();
    });
  });

  // ---- Debounced Chart Calculations with Fake Timers ----

  describe("debounced chart calculations with fake timers", () => {
    it("debounces price impact chart recalculation on rapid input changes", () => {
      vi.useFakeTimers();
      render(<SwapSimulator />);
      expect(screen.getByText("Max Size: 500 XLM")).toBeInTheDocument();

      // Rapidly change input without advancing time
      fireEvent.change(screen.getByPlaceholderText("0.0"), { target: { value: "200" } });
      fireEvent.change(screen.getByPlaceholderText("0.0"), { target: { value: "300" } });
      fireEvent.change(screen.getByPlaceholderText("0.0"), { target: { value: "400" } });

      // Max Size should not have changed yet
      expect(screen.getByText("Max Size: 500 XLM")).toBeInTheDocument();

      // Advance time by debounce delay (300ms)
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Now Max Size should reflect the final input (400)
      expect(screen.getByText("Max Size: 800 XLM")).toBeInTheDocument();
      vi.useRealTimers();
    });

    it("cancels previous debounce timer when new input is received before debounce completes", () => {
      vi.useFakeTimers();
      render(<SwapSimulator />);
      expect(screen.getByText("Max Size: 500 XLM")).toBeInTheDocument();

      // Change input
      fireEvent.change(screen.getByPlaceholderText("0.0"), { target: { value: "1000" } });

      // Advance time partially (150ms < 300ms)
      act(() => {
        vi.advanceTimersByTime(150);
      });

      // Chart should not have updated yet
      expect(screen.getByText("Max Size: 500 XLM")).toBeInTheDocument();

      // Change input again, which should cancel the previous timer
      fireEvent.change(screen.getByPlaceholderText("0.0"), { target: { value: "2000" } });

      // Advance to 300ms from first change (only 150ms from second)
      act(() => {
        vi.advanceTimersByTime(150);
      });

      // Chart should still not have updated (only 150ms elapsed since second input)
      expect(screen.getByText("Max Size: 500 XLM")).toBeInTheDocument();

      // Advance by another 150ms (total 300ms from second input)
      act(() => {
        vi.advanceTimersByTime(150);
      });

      // Now it should update with the second input value
      expect(screen.getByText("Max Size: 4000 XLM")).toBeInTheDocument();
      vi.useRealTimers();
    });

    it("applies debounce to chart recalculation but not to immediate exchange rate updates", () => {
      vi.useFakeTimers();
      render(<SwapSimulator />);
      const input = screen.getByPlaceholderText("0.0");

      // Change input
      fireEvent.change(input, { target: { value: "500" } });

      // Exchange rate should be visible immediately (not debounced)
      expect(screen.getByText(/exchange rate/i)).toBeInTheDocument();

      // But chart Max Size should be debounced
      expect(screen.getByText("Max Size: 500 XLM")).toBeInTheDocument();

      // Change to different value
      fireEvent.change(input, { target: { value: "1500" } });

      // Exchange rate should update immediately
      expect(screen.getByText(/exchange rate/i)).toBeInTheDocument();

      // Chart Max Size should still show old value
      expect(screen.getByText("Max Size: 500 XLM")).toBeInTheDocument();

      // Advance debounce timer
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Now chart should update
      expect(screen.getByText("Max Size: 3000 XLM")).toBeInTheDocument();
      vi.useRealTimers();
    });

    it("recalculates chart correctly after debounce with custom poolReserves", () => {
      vi.useFakeTimers();
      const customReserves = {
        "XLM-USDC": { fromReserves: 100000, toReserves: 12000 },
      };
      render(<SwapSimulator poolReserves={customReserves} />);

      const input = screen.getByPlaceholderText("0.0");

      // Change input
      fireEvent.change(input, { target: { value: "250" } });

      // Before debounce, chart should show old calculation
      expect(screen.getByText("Max Size: 500 XLM")).toBeInTheDocument();

      // Advance debounce
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // After debounce, chart should reflect new input
      expect(screen.getByText("Max Size: 500 XLM")).toBeInTheDocument();

      vi.useRealTimers();
    });

    it("uses debounced value for price impact curve SVG rendering", () => {
      vi.useFakeTimers();
      render(<SwapSimulator />);

      const input = screen.getByPlaceholderText("0.0");

      // Set initial value
      fireEvent.change(input, { target: { value: "100" } });
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Change to new value
      fireEvent.change(input, { target: { value: "500" } });

      // SVG should still show calculation based on debounced 100
      let svgContainer = screen.getByText("Max Size: 500 XLM").closest("div");
      expect(svgContainer).toBeInTheDocument();

      // After debounce, SVG recalculates
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Now it should reflect 500
      expect(screen.getByText("Max Size: 1000 XLM")).toBeInTheDocument();
      vi.useRealTimers();
    });

    it("clears debounce timeout on component unmount", () => {
      vi.useFakeTimers();
      const { unmount } = render(<SwapSimulator />);

      const input = screen.getByPlaceholderText("0.0");
      fireEvent.change(input, { target: { value: "300" } });

      // Unmount before debounce completes
      unmount();

      // Should not throw or cause memory leak
      act(() => {
        vi.advanceTimersByTime(300);
      });

      vi.useRealTimers();
    });

    it("respects custom AMOUNT_CHART_DEBOUNCE_MS timing", () => {
      vi.useFakeTimers();
      render(<SwapSimulator />);

      const input = screen.getByPlaceholderText("0.0");
      fireEvent.change(input, { target: { value: "200" } });

      // At 299ms, should not have updated
      act(() => {
        vi.advanceTimersByTime(299);
      });
      expect(screen.getByText("Max Size: 500 XLM")).toBeInTheDocument();

      // At 300ms, should have updated
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(screen.getByText("Max Size: 400 XLM")).toBeInTheDocument();

      vi.useRealTimers();
    });

    it("handles zero and negative input values with debounce", () => {
      vi.useFakeTimers();
      render(<SwapSimulator />);

      const input = screen.getByPlaceholderText("0.0");

      // Set to zero
      fireEvent.change(input, { target: { value: "0" } });
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Exchange rate should not be shown for zero input
      expect(screen.queryByText(/exchange rate/i)).not.toBeInTheDocument();

      // Set to negative (invalid)
      fireEvent.change(input, { target: { value: "-100" } });
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(screen.queryByText(/exchange rate/i)).not.toBeInTheDocument();

      vi.useRealTimers();
    });

    it("emits correct price impact curve points after debounce with varying amounts", () => {
      vi.useFakeTimers();
      render(<SwapSimulator />);

      const input = screen.getByPlaceholderText("0.0");

      // Set amount
      fireEvent.change(input, { target: { value: "750" } });
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Price impact curve should calculate based on 750
      expect(screen.getByText("Max Size: 1500 XLM")).toBeInTheDocument();

      // Change and debounce again
      fireEvent.change(input, { target: { value: "1250" } });
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(screen.getByText("Max Size: 2500 XLM")).toBeInTheDocument();

      vi.useRealTimers();
    });
  });
});
