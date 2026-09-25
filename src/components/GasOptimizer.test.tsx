import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  GAS_PRESETS,
  GasOptimizer,
  MAX_CPU_INSTRUCTIONS,
  MAX_MEMORY_BYTES,
  MIN_CPU_INSTRUCTIONS,
  MIN_MEMORY_BYTES,
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

      expect(execCommandSpy).toHaveBeenCalledWith("copy");
    });
  });
});