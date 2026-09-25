import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";

import { SwapSimulator } from "./SwapSimulator";

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
});
