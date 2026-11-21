import { act,fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { parseContractPanic } from "@/lib/diagnostics";

import {
  computeResourceCosts,
  GAS_PRESETS,
  GasOptimizer,
  MAX_CPU_INSTRUCTIONS,
  MAX_MEMORY_BYTES,
  MIN_CPU_INSTRUCTIONS,
  MIN_MEMORY_BYTES,
  RESOURCE_FEE_RATES,
} from "./GasOptimizer";

vi.mock("@/lib/client", () => ({
  getClient: vi.fn(),
}));

import type { GasEstimate, GasPriceData, SorokitClient } from "@/lib/client";
import { getClient } from "@/lib/client";

const MOCK_GAS_PRICE_DATA: GasPriceData = {
  baseFee: "100",
  gasPrice: "100",
  ledgerCloseTime: 5,
  baseReserve: "0.5",
};

const MOCK_GAS_ESTIMATE: GasEstimate = {
  totalGasUnits: 750,
  breakdown: [
    { operationType: "payment", gasUnits: 100, feeStroops: "10000", feeXlm: "0.0010000" },
    { operationType: "manage_data", gasUnits: 200, feeStroops: "20000", feeXlm: "0.0020000" },
    { operationType: "change_trust", gasUnits: 300, feeStroops: "30000", feeXlm: "0.0030000" },
  ],
  scenarios: [
    { label: "low", gasPrice: "50", totalFeeStroops: "3750", totalFeeXlm: "0.0003750", savings: "50%" },
    { label: "average", gasPrice: "100", totalFeeStroops: "7500", totalFeeXlm: "0.0007500", savings: "0%" },
    { label: "high", gasPrice: "200", totalFeeStroops: "15000", totalFeeXlm: "0.0015000", savings: "-100%" },
  ],
  customMultiplier: 1,
};

function mockClient(overrides?: Partial<SorokitClient>) {
  const defaultEstimateFee = vi.fn().mockResolvedValue({
    data: { baseFee: "100", recommended: "1000" },
    error: null,
  });
  const defaultEstimateDetailedFee = vi.fn().mockResolvedValue({
    data: MOCK_GAS_ESTIMATE,
    error: null,
  });
  const defaultGetFeeScenarios = vi.fn().mockResolvedValue({
    data: MOCK_GAS_ESTIMATE.scenarios,
    error: null,
  });
  const defaultGetGasPrice = vi.fn().mockResolvedValue({
    data: MOCK_GAS_PRICE_DATA,
    error: null,
  });

  vi.mocked(getClient).mockReturnValue({
    network: {
      getNetwork: vi.fn(),
      switchNetwork: vi.fn(),
      getGasPrice: defaultGetGasPrice,
      ...overrides?.network,
    },
    transaction: {
      submit: vi.fn(),
      getStatus: vi.fn(),
      getHistory: vi.fn(),
      estimateFee: defaultEstimateFee,
      estimateDetailedFee: defaultEstimateDetailedFee,
      getFeeScenarios: defaultGetFeeScenarios,
      ...overrides?.transaction,
    },
    wallet: {
      connect: vi.fn(),
      disconnect: vi.fn(),
      getAddress: vi.fn(),
      ...overrides?.wallet,
    },
    account: {
      getAccount: vi.fn(),
      getBalances: vi.fn(),
      getClaimableBalances: vi.fn(),
      claimBalance: vi.fn(),
      ...overrides?.account,
    },
    soroban: {
      invokeContract: vi.fn(),
      getEvents: vi.fn(),
      ...overrides?.soroban,
    },
    nft: {
      getNfts: vi.fn(),
      sendNft: vi.fn(),
      listNftForSale: vi.fn(),
      ...overrides?.nft,
    },
  } as unknown as SorokitClient);

  return {
    estimateDetailedFee: defaultEstimateDetailedFee,
    getFeeScenarios: defaultGetFeeScenarios,
    getGasPrice: defaultGetGasPrice,
  };
}

describe("GasOptimizer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the loading skeleton before data arrives", () => {
    vi.mocked(getClient).mockReturnValue({
      network: { getNetwork: vi.fn(), switchNetwork: vi.fn(), getGasPrice: vi.fn().mockReturnValue(new Promise(() => {})) },
      transaction: { submit: vi.fn(), getStatus: vi.fn(), getHistory: vi.fn(), estimateFee: vi.fn(), estimateDetailedFee: vi.fn().mockReturnValue(new Promise(() => {})), getFeeScenarios: vi.fn() },
      wallet: { connect: vi.fn(), disconnect: vi.fn(), getAddress: vi.fn() },
      account: { getAccount: vi.fn(), getBalances: vi.fn(), getClaimableBalances: vi.fn(), claimBalance: vi.fn() },
      soroban: { invokeContract: vi.fn(), getEvents: vi.fn() },
      nft: { getNfts: vi.fn(), sendNft: vi.fn(), listNftForSale: vi.fn() },
    } as unknown as SorokitClient);

    const { container } = render(<GasOptimizer />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders the section title", async () => {
    mockClient();
    render(<GasOptimizer />);
    await waitFor(() => expect(screen.getByText("Gas Optimizer")).toBeInTheDocument());
  });

  it("displays network stats (base reserve and ledger close time)", async () => {
    mockClient();
    render(<GasOptimizer />);

    await waitFor(() => {
      expect(screen.getByText("0.5 XLM")).toBeInTheDocument();
      expect(screen.getByText("5s")).toBeInTheDocument();
    });
  });

  it("displays gas price in stroops per operation", async () => {
    mockClient();
    render(<GasOptimizer />);

    await waitFor(() => {
      expect(screen.getByText("100 stroops/op")).toBeInTheDocument();
    });
  });

  it("displays total gas units", async () => {
    mockClient();
    render(<GasOptimizer />);

    await waitFor(() => {
      expect(screen.getByText("750 units")).toBeInTheDocument();
    });
  });

  it("shows cost breakdown by operation type", async () => {
    mockClient();
    render(<GasOptimizer />);

    await waitFor(() => {
      expect(screen.getByText("payment")).toBeInTheDocument();
      expect(screen.getByText("manage data")).toBeInTheDocument();
      expect(screen.getByText("change trust")).toBeInTheDocument();
    });
  });

  it("shows total fee in stroops and XLM", async () => {
    mockClient();
    render(<GasOptimizer />);

    await waitFor(() => {
      expect(screen.getByText("Estimated Total Fee")).toBeInTheDocument();
    });
  });

  it("provides optimization suggestions", async () => {
    mockClient();
    render(<GasOptimizer />);

    await waitFor(() => {
      expect(screen.getByText("Optimization Tips")).toBeInTheDocument();
    });
  });

  it("allows user to set custom gas price multiplier via slider", async () => {
    mockClient();
    render(<GasOptimizer />);

    await waitFor(() => expect(screen.getByText("0.5x")).toBeInTheDocument());

    const slider = screen.getByRole("slider", { name: "Gas price multiplier" });
    expect(slider).toHaveValue("1");

    fireEvent.change(slider, { target: { value: "1.5" } });
    await waitFor(() => {
      expect(screen.getByText("1.5x")).toBeInTheDocument();
    });
  });

  it("shows fee comparison (low/average/high scenarios)", async () => {
    mockClient();
    render(<GasOptimizer />);

    await waitFor(() => {
      expect(screen.getByText("Fee Scenarios")).toBeInTheDocument();
      expect(screen.getByText("low")).toBeInTheDocument();
      expect(screen.getByText("average")).toBeInTheDocument();
      expect(screen.getByText("high")).toBeInTheDocument();
    });
  });

  it("displays estimated savings in scenarios", async () => {
    mockClient();
    render(<GasOptimizer />);

    await waitFor(() => {
      expect(screen.getByText("50%")).toBeInTheDocument();
    });
  });

  it("renders the error message when the client returns an error", async () => {
    mockClient({
      network: { getNetwork: vi.fn(), switchNetwork: vi.fn(), getGasPrice: vi.fn().mockResolvedValue({ data: null, error: "RPC error" }) },
    });
    render(<GasOptimizer />);

    await waitFor(() => {
      expect(screen.getByText("RPC error")).toBeInTheDocument();
    });
  });

  it("shows error state when estimateDetailedFee fails", async () => {
    mockClient({
      transaction: {
        submit: vi.fn(),
        getStatus: vi.fn(),
        getHistory: vi.fn(),
        estimateFee: vi.fn(),
        estimateDetailedFee: vi.fn().mockResolvedValue({ data: null, error: "Simulation failed" }),
        getFeeScenarios: vi.fn(),
      },
    });
    render(<GasOptimizer />);

    await waitFor(() => {
      expect(screen.getByText("Simulation failed")).toBeInTheDocument();
    });
  });

  it("renders empty operations message when no operations are provided", async () => {
    const emptyEstimate: GasEstimate = {
      totalGasUnits: 0,
      breakdown: [],
      scenarios: [],
      customMultiplier: 1,
    };
    mockClient({
      transaction: {
        submit: vi.fn(),
        getStatus: vi.fn(),
        getHistory: vi.fn(),
        estimateFee: vi.fn(),
        estimateDetailedFee: vi.fn().mockResolvedValue({ data: emptyEstimate, error: null }),
        getFeeScenarios: vi.fn(),
      },
    });
    render(<GasOptimizer operations={[]} />);

    await waitFor(() => {
      expect(screen.getByText("No operations to break down")).toBeInTheDocument();
    });
  });

  it("calls getGasPrice and estimateDetailedFee on mount", async () => {
    const { getGasPrice, estimateDetailedFee } = mockClient();
    render(<GasOptimizer operations={["payment", "manage_data", "change_trust"]} />);

    await waitFor(() => {
      expect(getGasPrice).toHaveBeenCalled();
      expect(estimateDetailedFee).toHaveBeenCalledWith({
        operations: ["payment", "manage_data", "change_trust"],
        feeMultiplier: 1,
      });
    });
  });

  it("calls loadGasData when refresh button is clicked", async () => {
    const { getGasPrice } = mockClient();
    render(<GasOptimizer />);

    await waitFor(() => expect(screen.getByText("0.5 XLM")).toBeInTheDocument());

    const refreshButton = screen.getByTitle("Refresh gas data");
    fireEvent.click(refreshButton);

    await waitFor(() => expect(getGasPrice).toHaveBeenCalledTimes(2));
  });

  it("disables the refresh button while loading", async () => {
    vi.mocked(getClient).mockReturnValue({
      network: { getNetwork: vi.fn(), switchNetwork: vi.fn(), getGasPrice: vi.fn().mockReturnValue(new Promise(() => {})) },
      transaction: { submit: vi.fn(), getStatus: vi.fn(), getHistory: vi.fn(), estimateFee: vi.fn(), estimateDetailedFee: vi.fn().mockReturnValue(new Promise(() => {})), getFeeScenarios: vi.fn() },
      wallet: { connect: vi.fn(), disconnect: vi.fn(), getAddress: vi.fn() },
      account: { getAccount: vi.fn(), getBalances: vi.fn(), getClaimableBalances: vi.fn(), claimBalance: vi.fn() },
      soroban: { invokeContract: vi.fn(), getEvents: vi.fn() },
      nft: { getNfts: vi.fn(), sendNft: vi.fn(), listNftForSale: vi.fn() },
    } as unknown as SorokitClient);

    render(<GasOptimizer />);
    const refreshButton = screen.getByTitle("Refresh gas data");
    expect(refreshButton).toBeDisabled();
  });

  it("updates the multiplier display when slider changes", async () => {
    mockClient();
    render(<GasOptimizer />);

    await waitFor(() => expect(screen.getByText("0.5x")).toBeInTheDocument());

    const slider = screen.getByRole("slider", { name: "Gas price multiplier" });
    expect(slider).toHaveValue("1");

    fireEvent.change(slider, { target: { value: "2" } });
    await waitFor(() => expect(screen.getAllByText("2.0x")[0]).toBeInTheDocument());
  });

  it("supports custom operations prop", async () => {
    mockClient();
    render(<GasOptimizer operations={["payment"]} />);

    await waitFor(() => {
      expect(screen.getByText("payment")).toBeInTheDocument();
    });
  });

  it("has a polite live region for accessibility", async () => {
    mockClient();
    const { container } = render(<GasOptimizer />);

    await waitFor(() => {
      const liveRegion = container.querySelector('[aria-live="polite"]');
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion).toHaveAttribute("aria-atomic", "true");
    });
  });

  it("has a refresh button with accessible label", async () => {
    mockClient();
    render(<GasOptimizer />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Refresh gas data" })).toBeInTheDocument();
    });
  });

  it("displays network close time in correct format for minutes", async () => {
    const customGasData: GasPriceData = {
      baseFee: "100",
      gasPrice: "100",
      ledgerCloseTime: 65,
      baseReserve: "0.5",
    };
    mockClient({
      network: {
        getNetwork: vi.fn(),
        switchNetwork: vi.fn(),
        getGasPrice: vi.fn().mockResolvedValue({ data: customGasData, error: null }),
      },
    });
    render(<GasOptimizer />);

    await waitFor(() => {
      expect(screen.getByText("1m 5s")).toBeInTheDocument();
    });
  });

  it("displays the refresh button with spin animation when loading", async () => {
    mockClient();
    render(<GasOptimizer />);

    await waitFor(() => {
      const refreshButton = screen.getByTitle("Refresh gas data");
      const svg = refreshButton.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });
  });

  it("renders the card-based UI with correct structure", async () => {
    mockClient();
    const { container } = render(<GasOptimizer />);

    await waitFor(() => {
      const card = container.querySelector(".rounded-xl.border.border-line.bg-surface");
      expect(card).toBeInTheDocument();
    });
  });

  it("handles getFeeScenarios error gracefully", async () => {
    mockClient({
      network: {
        getNetwork: vi.fn(),
        switchNetwork: vi.fn(),
        getGasPrice: vi.fn().mockResolvedValue({ data: MOCK_GAS_PRICE_DATA, error: null }),
      },
      transaction: {
        submit: vi.fn(),
        getStatus: vi.fn(),
        getHistory: vi.fn(),
        estimateFee: vi.fn(),
        estimateDetailedFee: vi.fn().mockResolvedValue({ data: MOCK_GAS_ESTIMATE, error: null }),
        getFeeScenarios: vi.fn().mockResolvedValue({ data: null, error: "Scenarios unavailable" }),
      },
    });
    render(<GasOptimizer />);

    await waitFor(() => {
      expect(screen.getByText("Scenarios unavailable")).toBeInTheDocument();
    });
  });

  describe("Soroban Protocol Execution Boundaries & Sliders", () => {
    it("renders CPU instructions and memory limit sliders with protocol limits", async () => {
      mockClient();
      render(<GasOptimizer />);

      await waitFor(() => {
        expect(
          screen.getByRole("slider", { name: "CPU instructions" }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole("slider", { name: "Memory limit" }),
        ).toBeInTheDocument();
      });

      const cpuSlider = screen.getByRole("slider", { name: "CPU instructions" });
      expect(cpuSlider).toHaveAttribute("min", String(MIN_CPU_INSTRUCTIONS));
      expect(cpuSlider).toHaveAttribute("max", String(MAX_CPU_INSTRUCTIONS));

      const memorySlider = screen.getByRole("slider", { name: "Memory limit" });
      expect(memorySlider).toHaveAttribute("min", String(MIN_MEMORY_BYTES));
      expect(memorySlider).toHaveAttribute("max", String(MAX_MEMORY_BYTES));
    });

    it("clamps CPU instruction slider to protocol minimum (40,000) when dragged below", async () => {
      mockClient();
      render(<GasOptimizer />);

      await waitFor(() =>
        expect(screen.getByRole("slider", { name: "CPU instructions" })).toBeInTheDocument(),
      );

      const cpuSlider = screen.getByRole("slider", { name: "CPU instructions" });
      fireEvent.change(cpuSlider, { target: { value: "10000" } });

      expect(cpuSlider).toHaveValue(String(MIN_CPU_INSTRUCTIONS));
      expect(screen.getByText("40,000")).toBeInTheDocument();
    });

    it("clamps CPU instruction slider to protocol maximum (100,000,000) when dragged above", async () => {
      mockClient();
      render(<GasOptimizer />);

      await waitFor(() =>
        expect(screen.getByRole("slider", { name: "CPU instructions" })).toBeInTheDocument(),
      );

      const cpuSlider = screen.getByRole("slider", { name: "CPU instructions" });
      fireEvent.change(cpuSlider, { target: { value: "150000000" } });

      expect(cpuSlider).toHaveValue(String(MAX_CPU_INSTRUCTIONS));
      expect(screen.getByText("100,000,000")).toBeInTheDocument();
    });

    it("clamps memory slider to Soroban minimum requirement (1,048,576 B) when dragged below", async () => {
      mockClient();
      render(<GasOptimizer />);

      await waitFor(() =>
        expect(screen.getByRole("slider", { name: "Memory limit" })).toBeInTheDocument(),
      );

      const memorySlider = screen.getByRole("slider", { name: "Memory limit" });
      fireEvent.change(memorySlider, { target: { value: "50000" } });

      expect(memorySlider).toHaveValue(String(MIN_MEMORY_BYTES));
      expect(screen.getByText("1.0 MB")).toBeInTheDocument();
    });

    it("clamps memory slider to Soroban protocol maximum (41,943,040 B) when dragged above", async () => {
      mockClient();
      render(<GasOptimizer />);

      await waitFor(() =>
        expect(screen.getByRole("slider", { name: "Memory limit" })).toBeInTheDocument(),
      );

      const memorySlider = screen.getByRole("slider", { name: "Memory limit" });
      fireEvent.change(memorySlider, { target: { value: "50000000" } });

      expect(memorySlider).toHaveValue(String(MAX_MEMORY_BYTES));
      expect(screen.getByText("40.0 MB")).toBeInTheDocument();
    });

    it("automatically switches active preset to Custom when adjusting sliders", async () => {
      mockClient();
      render(<GasOptimizer />);

      await waitFor(() =>
        expect(screen.getByRole("slider", { name: "CPU instructions" })).toBeInTheDocument(),
      );

      const cpuSlider = screen.getByRole("slider", { name: "CPU instructions" });
      fireEvent.change(cpuSlider, { target: { value: "30000000" } });

      const customBtn = screen.getByRole("button", { name: "Custom" });
      expect(customBtn).toHaveAttribute("aria-pressed", "true");
    });
  });

  describe("Optimization Presets & Screen-Reader Announcements", () => {
    it("renders Conservative, Aggressive, and Custom preset buttons", async () => {
      mockClient();
      render(<GasOptimizer />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Conservative" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Aggressive" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Custom" })).toBeInTheDocument();
      });
    });

    it("announces updated values to screen readers when selecting Conservative preset", async () => {
      mockClient();
      render(<GasOptimizer />);

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Aggressive" })).toBeInTheDocument(),
      );

      // Switch to Aggressive first, then Conservative to trigger change
      fireEvent.click(screen.getByRole("button", { name: "Aggressive" }));
      fireEvent.click(screen.getByRole("button", { name: "Conservative" }));

      const status = screen.getByRole("status");
      expect(status).toHaveAttribute("aria-live", "polite");
      expect(status).toHaveTextContent(/Preset changed to Conservative/i);
      expect(status).toHaveTextContent(
        GAS_PRESETS.Conservative.cpuInstructions.toLocaleString(),
      );
      expect(status).toHaveTextContent(
        GAS_PRESETS.Conservative.memoryBytes.toLocaleString(),
      );
    });

    it("announces updated values to screen readers when selecting Aggressive preset", async () => {
      mockClient();
      render(<GasOptimizer />);

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Aggressive" })).toBeInTheDocument(),
      );

      fireEvent.click(screen.getByRole("button", { name: "Aggressive" }));

      const status = screen.getByRole("status");
      expect(status).toHaveAttribute("aria-live", "polite");
      expect(status).toHaveTextContent(/Preset changed to Aggressive/i);
      expect(status).toHaveTextContent(
        GAS_PRESETS.Aggressive.cpuInstructions.toLocaleString(),
      );
      expect(status).toHaveTextContent(
        GAS_PRESETS.Aggressive.memoryBytes.toLocaleString(),
      );

      const cpuSlider = screen.getByRole("slider", { name: "CPU instructions" });
      expect(cpuSlider).toHaveValue(String(GAS_PRESETS.Aggressive.cpuInstructions));
    });

    it("announces updated values to screen readers when selecting Custom preset", async () => {
      mockClient();
      render(<GasOptimizer />);

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Custom" })).toBeInTheDocument(),
      );

      fireEvent.click(screen.getByRole("button", { name: "Custom" }));

      const status = screen.getByRole("status");
      expect(status).toHaveAttribute("aria-live", "polite");
      expect(status).toHaveTextContent(/Preset changed to Custom/i);
    });
  });

  describe("JSON Configuration Export", () => {
    it("renders the Export Config button in the header", async () => {
      mockClient();
      render(<GasOptimizer />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Export Config" }),
        ).toBeInTheDocument();
      });
    });

    it("exports valid JSON matching Sorokit CLI configuration and copies to clipboard", async () => {
      mockClient();
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: writeTextMock },
        configurable: true,
        writable: true,
      });

      render(<GasOptimizer />);

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Export Config" })).toBeInTheDocument(),
      );

      fireEvent.click(screen.getByRole("button", { name: "Export Config" }));

      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalled();
      });

      const exportedString = writeTextMock.mock.calls[0][0];
      const parsed = JSON.parse(exportedString);

      expect(parsed).toHaveProperty("version", "1.0.0");
      expect(parsed).toHaveProperty("network");
      expect(parsed).toHaveProperty("preset");
      expect(parsed).toHaveProperty("instructions");
      expect(parsed.instructions).toBeGreaterThanOrEqual(MIN_CPU_INSTRUCTIONS);
      expect(parsed.instructions).toBeLessThanOrEqual(MAX_CPU_INSTRUCTIONS);
      expect(parsed).toHaveProperty("memory");
      expect(parsed.memory).toBeGreaterThanOrEqual(MIN_MEMORY_BYTES);
      expect(parsed.memory).toBeLessThanOrEqual(MAX_MEMORY_BYTES);
      expect(parsed).toHaveProperty("feeMultiplier");
      expect(parsed).toHaveProperty("resources");
      expect(parsed.resources).toEqual({
        instructions: parsed.instructions,
        memory: parsed.memory,
      });
      expect(parsed.operations).toEqual(["payment"]);
    });

    it("triggers onExport callback prop when provided", async () => {
      mockClient();
      const onExport = vi.fn();
      render(<GasOptimizer onExport={onExport} />);

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Export Config" })).toBeInTheDocument(),
      );

      fireEvent.click(screen.getByRole("button", { name: "Export Config" }));

      expect(onExport).toHaveBeenCalledWith(
        expect.objectContaining({
          version: "1.0.0",
          instructions: expect.any(Number),
          memory: expect.any(Number),
          feeMultiplier: expect.any(Number),
        }),
      );
    });

    it("announces export completion to screen readers and shows visual feedback", async () => {
      mockClient();
      render(<GasOptimizer />);

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Export Config" })).toBeInTheDocument(),
      );

      fireEvent.click(screen.getByRole("button", { name: "Export Config" }));

      await waitFor(() => {
        expect(screen.getByText("Exported!")).toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent(
          /Gas configuration exported to clipboard/i,
        );
      });
    });

    it("falls back to document.execCommand when navigator.clipboard is unavailable", async () => {
      mockClient();
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        configurable: true,
        writable: true,
      });

      const execCommandSpy = vi.fn().mockReturnValue(true);
      document.execCommand = execCommandSpy;

      render(<GasOptimizer />);

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Export Config" })).toBeInTheDocument(),
      );

      fireEvent.click(screen.getByRole("button", { name: "Export Config" }));

  });
  
  });
  
  describe("Visibility polling (#772)", () => {
    it("pauses polling when isVisible is false and resumes when true", async () => {
      vi.useFakeTimers();
      
      let observerCallback: IntersectionObserverCallback | undefined;
      vi.stubGlobal(
        "IntersectionObserver",
        vi.fn((cb) => {
          observerCallback = cb;
          return {
            observe: vi.fn(),
            unobserve: vi.fn(),
            disconnect: vi.fn(),
          };
        })
      );
      
      const { getGasPrice } = mockClient();
      
      const { unmount } = render(<GasOptimizer refreshInterval={5000} />);
      
      await vi.runOnlyPendingTimersAsync();
      const count1 = getGasPrice.mock.calls.length;
      
      // Change visibility to false
      act(() => {
        observerCallback?.([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
      });
      
      // Advance timers by multiple intervals
      await act(async () => {
        vi.advanceTimersByTime(15000);
      });
      
      // Should not have polled while invisible
      expect(getGasPrice.mock.calls.length).toBe(count1);
      
      // Change visibility to true
      act(() => {
        observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
      });
      
      // Wait for immediate resumption effect
      await vi.runOnlyPendingTimersAsync();
      
      // Advance by one interval
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
      
      expect(getGasPrice.mock.calls.length).toBeGreaterThan(count1);
      
      unmount();
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });
  });
});
// ── Issue #959: resource breakdown, panic diagnostics, zero-limit cases ──────
function mockFeeResult(result: { data: GasEstimate | null; error: string | null }) {
  return mockClient({
    transaction: {
      submit: vi.fn(),
      getStatus: vi.fn(),
      getHistory: vi.fn(),
      estimateFee: vi.fn(),
      estimateDetailedFee: vi.fn().mockResolvedValue(result),
      getFeeScenarios: vi.fn().mockResolvedValue({
        data: result.data?.scenarios ?? [],
        error: null,
      }),
    } as unknown as SorokitClient["transaction"],
  });
}

async function openResourceBreakdown() {
  const toggle = await screen.findByRole("button", { name: /resource breakdown/i });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
}

describe("GasOptimizer — issue #959", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Resource Breakdown", () => {
    it("is collapsed by default and expands to show each resource", async () => {
      mockFeeResult({
        data: {
          ...MOCK_GAS_ESTIMATE,
          resources: {
            cpuInstructions: 2_000_000,
            memoryBytes: 3_145_728,
            readBytes: 2048,
            writeBytes: 1024,
          },
        },
        error: null,
      });
      render(<GasOptimizer />);

      await screen.findByRole("button", { name: /resource breakdown/i });
      expect(screen.queryByTestId("resource-cpu")).not.toBeInTheDocument();
      await openResourceBreakdown();

      expect(screen.getByText("Resources consumed in simulation.")).toBeInTheDocument();
      // 2,000,000 instructions * 25 / 10,000 = 5,000 stroops.
      expect(screen.getByTestId("resource-cpu")).toHaveTextContent("2,000,000 instructions");
      expect(screen.getByTestId("resource-cpu")).toHaveTextContent("5,000");
      expect(screen.getByTestId("resource-memory")).toHaveTextContent("3,145,728 bytes");
      // 2 KB read * 1,786 = 3,572 stroops; 1 KB written * 11,800 = 11,800.
      expect(screen.getByTestId("resource-read")).toHaveTextContent("2,048 bytes");
      expect(screen.getByTestId("resource-read")).toHaveTextContent("3,572");
      expect(screen.getByTestId("resource-write")).toHaveTextContent("1,024 bytes");
      expect(screen.getByTestId("resource-write")).toHaveTextContent("11,800");
      expect(screen.getByTestId("resource-total")).toHaveTextContent("20,372");
    });

    it("falls back to the configured limits when the estimate has no simulation data", async () => {
      mockClient();
      render(<GasOptimizer />);
      await openResourceBreakdown();

      expect(screen.getByText(/configured execution limits/)).toBeInTheDocument();
      expect(screen.getByTestId("resource-cpu")).toHaveTextContent(
        `${GAS_PRESETS.Conservative.cpuInstructions.toLocaleString()} instructions`,
      );
      expect(screen.getByTestId("resource-read")).toHaveTextContent("0 bytes");
    });

    it("renders zeros (not NaN) when resource limits are empty", async () => {
      mockFeeResult({
        data: { ...MOCK_GAS_ESTIMATE, resources: {} },
        error: null,
      });
      render(<GasOptimizer />);
      await openResourceBreakdown();

      for (const key of ["cpu", "memory", "read", "write"]) {
        expect(screen.getByTestId(`resource-${key}`)).not.toHaveTextContent("NaN");
      }
      expect(screen.getByTestId("resource-cpu")).toHaveTextContent("0 instructions");
      expect(screen.getByTestId("resource-total")).toHaveTextContent("0");
    });

    it("computeResourceCosts handles missing, zero, negative and non-finite limits", () => {
      for (const resources of [
        undefined,
        {},
        { cpuInstructions: 0, memoryBytes: 0, readBytes: 0, writeBytes: 0 },
        { cpuInstructions: -5, readBytes: Number.NaN, writeBytes: Number.POSITIVE_INFINITY },
      ]) {
        const costs = computeResourceCosts(resources);
        expect(costs.map((c) => c.key)).toEqual(["cpu", "memory", "read", "write"]);
        expect(costs.every((c) => c.amount === 0 && c.feeStroops === 0)).toBe(true);
      }
    });

    it("computeResourceCosts rounds each fee up to a whole stroop", () => {
      const costs = computeResourceCosts({ cpuInstructions: 1, readBytes: 1, writeBytes: 1 });
      expect(costs.find((c) => c.key === "cpu")?.feeStroops).toBe(1);
      expect(costs.find((c) => c.key === "read")?.feeStroops).toBe(
        Math.ceil(RESOURCE_FEE_RATES.feeRead1Kb / 1024),
      );
      expect(costs.find((c) => c.key === "write")?.feeStroops).toBe(
        Math.ceil(RESOURCE_FEE_RATES.feeWrite1Kb / 1024),
      );
    });
  });

  describe("zero-fee transactions", () => {
    it("shows a 0 stroop total without NaN when every operation is free", async () => {
      mockFeeResult({
        data: {
          totalGasUnits: 0,
          breakdown: [
            { operationType: "payment", gasUnits: 0, feeStroops: "0", feeXlm: "0.0000000" },
          ],
          scenarios: MOCK_GAS_ESTIMATE.scenarios,
          customMultiplier: 1,
        },
        error: null,
      });
      const { container } = render(<GasOptimizer />);

      expect(await screen.findByText("Estimated Total Fee")).toBeInTheDocument();
      expect(container).not.toHaveTextContent("NaN");
      expect(screen.getAllByText("0.0000000").length).toBeGreaterThan(0);
    });

    it("treats empty fee strings as zero instead of producing NaN", async () => {
      mockFeeResult({
        data: {
          totalGasUnits: 0,
          breakdown: [{ operationType: "payment", gasUnits: 0, feeStroops: "", feeXlm: "" }],
          scenarios: MOCK_GAS_ESTIMATE.scenarios,
          customMultiplier: 1.5,
        },
        error: null,
      });
      const { container } = render(<GasOptimizer />);

      await screen.findByText("Estimated Total Fee");
      expect(container).not.toHaveTextContent("NaN");
    });
  });

  describe("simulation panic diagnostics", () => {
    const PANIC_ERROR = [
      "HostError: Error(WasmVm, InvalidAction)",
      "",
      "Event log (newest first):",
      "   0: [Diagnostic Event] contract:CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE, topics:[error, Error(WasmVm, InvalidAction)], data:[\"VM call trapped: UnreachableCodeReached\", transfer]",
      "   1: [Diagnostic Event] contract:CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE, topics:[log], data:\"panicked at 'attempt to subtract with overflow', src/lib.rs:42:9\"",
    ].join("\n");

    it("explains a contract panic in plain English instead of raw output", async () => {
      mockFeeResult({ data: null, error: PANIC_ERROR });
      render(<GasOptimizer />);

      const panel = await screen.findByTestId("contract-panic");
      expect(panel).toHaveAttribute("role", "alert");
      expect(panel).toHaveTextContent("Contract simulation failed");
      expect(panel).toHaveTextContent("The contract panicked (trapped) while executing.");
      expect(panel).toHaveTextContent('Reason: "attempt to subtract with overflow"');
      // Raw diagnostics are kept, but collapsed inside a <details> element.
      const details = panel.querySelector("details");
      expect(details).not.toBeNull();
      expect(details?.open).toBe(false);
    });

    it("describes a custom contract error code", async () => {
      mockFeeResult({
        data: null,
        error: "HostError: Error(Contract, #3)\nEvent log: [Diagnostic Event] topics:[error, Error(Contract, #3)]",
      });
      render(<GasOptimizer />);

      expect(await screen.findByTestId("contract-panic")).toHaveTextContent(
        "The contract rejected the call with its own error code 3.",
      );
    });

    it("extracts the panic message from base64 XDR diagnostic events", () => {
      // Printable SCVal string bytes inside an XDR blob, framed by binary.
      const xdr = btoa(
        "\u0000\u0000\u0000\u000e\u0000\u0000\u0000\u0005error" +
          "\u0000\u0000\u0000\u000e\u0000\u0000\u0000\u001dbalance is not sufficient\u0000\u0000\u0000",
      );
      const panic = parseContractPanic(`simulation failed: ${xdr}`);
      expect(panic?.panicMessage).toBe("balance is not sufficient");
      expect(panic?.summary).toContain("balance is not sufficient");
    });

    it("maps known host errors without a panic message", () => {
      expect(parseContractPanic("HostError: Error(Budget, ExceededLimit)")?.summary).toBe(
        "The contract ran out of its CPU or memory budget.",
      );
      expect(parseContractPanic("Error(Auth, InvalidAction)")?.summary).toMatch(/authorization/);
      expect(parseContractPanic("Error(Storage, Unknown)")?.summary).toBe(
        "The contract failed with a Storage error (Unknown).",
      );
    });

    it("leaves non-contract errors untouched", async () => {
      expect(parseContractPanic("RPC error")).toBeNull();
      expect(parseContractPanic("")).toBeNull();
      expect(parseContractPanic(null)).toBeNull();

      mockFeeResult({ data: null, error: "Network request failed" });
      render(<GasOptimizer />);
      expect(await screen.findByText("Network request failed")).toBeInTheDocument();
      expect(screen.queryByTestId("contract-panic")).not.toBeInTheDocument();
    });
  });
});
