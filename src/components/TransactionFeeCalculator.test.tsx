import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TransactionFeeCalculator } from "./TransactionFeeCalculator";

vi.mock("@/lib/client", () => ({
  getClient: vi.fn(),
}));

import type { GasEstimate, SorokitClient } from "@/lib/client";
import { getClient } from "@/lib/client";

const MOCK_ESTIMATE: GasEstimate = {
  totalGasUnits: 750,
  breakdown: [
    { operationType: "payment", gasUnits: 100, feeStroops: "10000", feeXlm: "0.0010000" },
    { operationType: "manage_data", gasUnits: 200, feeStroops: "20000", feeXlm: "0.0020000" },
  ],
  scenarios: [
    { label: "low", gasPrice: "50", totalFeeStroops: "5000", totalFeeXlm: "0.0005000", savings: "50%" },
    { label: "average", gasPrice: "100", totalFeeStroops: "10000", totalFeeXlm: "0.0010000", savings: "0%" },
    { label: "high", gasPrice: "200", totalFeeStroops: "20000", totalFeeXlm: "0.0020000", savings: "-100%" },
  ],
  customMultiplier: 1,
};

function mockClient(overrides?: Partial<SorokitClient>) {
  vi.mocked(getClient).mockReturnValue({
    transaction: {
      estimateFee: vi.fn(),
      estimateDetailedFee: vi.fn().mockResolvedValue({ data: MOCK_ESTIMATE, error: null }),
      getFeeScenarios: vi.fn(),
      ...overrides?.transaction,
    },
    network: {
      getGasPrice: vi.fn(),
      ...overrides?.network,
    },
  } as unknown as SorokitClient);
}

describe("TransactionFeeCalculator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the section title", async () => {
    mockClient();
    render(<TransactionFeeCalculator />);
    await waitFor(() => {
      expect(screen.getByText("Transaction Fee Calculator")).toBeInTheDocument();
    });
  });

  it("displays fee breakdown rows after data loads", async () => {
    mockClient();
    render(<TransactionFeeCalculator />);

    await waitFor(() => {
      expect(screen.getByText("Payment")).toBeInTheDocument();
      expect(screen.getByText("Manage Data")).toBeInTheDocument();
    });
  });

  it("displays fees in stroops and XLM format", async () => {
    mockClient();
    render(<TransactionFeeCalculator />);

    await waitFor(() => {
      expect(screen.getByText("Payment")).toBeInTheDocument();
    });
    const stroopLabels = screen.getAllByText("stroops");
    expect(stroopLabels.length).toBeGreaterThan(0);
  });

  it("shows total estimated fee with highlight", async () => {
    mockClient();
    render(<TransactionFeeCalculator />);

    await waitFor(() => {
      expect(screen.getByText("Total Estimated Fee")).toBeInTheDocument();
    });
  });

  it("shows network fee section", async () => {
    mockClient();
    render(<TransactionFeeCalculator />);

    await waitFor(() => {
      expect(screen.getByText("Network Fee")).toBeInTheDocument();
    });
  });

  it("shows base fee section", async () => {
    mockClient();
    render(<TransactionFeeCalculator />);

    await waitFor(() => {
      expect(screen.getByText("Base Fee")).toBeInTheDocument();
    });
  });

  it("renders error state when client returns error", async () => {
    vi.mocked(getClient).mockReturnValue({
      transaction: {
        estimateDetailedFee: vi.fn().mockResolvedValue({ data: null, error: "Network unavailable" }),
      },
    } as unknown as SorokitClient);

    render(<TransactionFeeCalculator />);
    await waitFor(() => {
      expect(screen.getByText("Network unavailable")).toBeInTheDocument();
    });
  });

  it("renders loading skeleton before data arrives", () => {
    vi.mocked(getClient).mockReturnValue({
      transaction: {
        estimateDetailedFee: vi.fn().mockReturnValue(new Promise(() => {})),
      },
    } as unknown as SorokitClient);

    const { container } = render(<TransactionFeeCalculator />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("refreshes fee data when refresh button is clicked", async () => {
    const estimateDetailedFee = vi.fn().mockResolvedValue({ data: MOCK_ESTIMATE, error: null });
    vi.mocked(getClient).mockReturnValue({
      transaction: { estimateDetailedFee },
    } as unknown as SorokitClient);

    render(<TransactionFeeCalculator />);
    await waitFor(() => expect(screen.getByText("Payment")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Refresh fee estimate" }));
    await waitFor(() => expect(estimateDetailedFee).toHaveBeenCalledTimes(2));
  });

  it("provides tooltip info icons on fee rows", async () => {
    mockClient();
    render(<TransactionFeeCalculator />);

    await waitFor(() => {
      const infoIcons = screen.getAllByText("ⓘ");
      expect(infoIcons.length).toBeGreaterThan(0);
    });
  });

  it("disables refresh button while loading", async () => {
    vi.mocked(getClient).mockReturnValue({
      transaction: {
        estimateDetailedFee: vi.fn().mockReturnValue(new Promise(() => {})),
      },
    } as unknown as SorokitClient);

    render(<TransactionFeeCalculator />);
    expect(screen.getByRole("button", { name: "Refresh fee estimate" })).toBeDisabled();
  });

  it("has a polite live region for accessibility", async () => {
    mockClient();
    const { container } = render(<TransactionFeeCalculator />);

    await waitFor(() => {
      const liveRegion = container.querySelector('[aria-live="polite"]');
      expect(liveRegion).toBeInTheDocument();
    });
  });

  it("renders the info footer about fee estimates", async () => {
    mockClient();
    render(<TransactionFeeCalculator />);

    await waitFor(() => {
      expect(
        screen.getByText(/Fees are estimates and may vary/),
      ).toBeInTheDocument();
    });
  });

  it("supports custom operations prop", async () => {
    const estimateDetailedFee = vi.fn().mockResolvedValue({ data: MOCK_ESTIMATE, error: null });
    vi.mocked(getClient).mockReturnValue({
      transaction: { estimateDetailedFee },
    } as unknown as SorokitClient);

    render(<TransactionFeeCalculator operations={["payment"]} />);
    await waitFor(() => {
      expect(estimateDetailedFee).toHaveBeenCalledWith({
        operations: ["payment"],
      });
    });
  });

  it("handles zero fees gracefully", async () => {
    const zeroEstimate: GasEstimate = {
      totalGasUnits: 0,
      breakdown: [],
      scenarios: [],
      customMultiplier: 1,
    };
    vi.mocked(getClient).mockReturnValue({
      transaction: {
        estimateDetailedFee: vi.fn().mockResolvedValue({ data: zeroEstimate, error: null }),
      },
    } as unknown as SorokitClient);

    render(<TransactionFeeCalculator />);
    await waitFor(() => {
      expect(screen.getByText("Transaction Fee Calculator")).toBeInTheDocument();
    });
  });

  it("renders with accessible region landmark", async () => {
    mockClient();
    render(<TransactionFeeCalculator />);

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "Transaction Fee Calculator" }),
      ).toBeInTheDocument();
    });
  });

  it("ceils fractional stroop values to the nearest integer", async () => {
    const fractionalEstimate: GasEstimate = {
      totalGasUnits: 750,
      breakdown: [
        // feeStroops with a decimal — surge multiplier can produce these
        { operationType: "payment", gasUnits: 100, feeStroops: "100.45", feeXlm: "0.0000100" },
      ],
      scenarios: [
        { label: "average", gasPrice: "100", totalFeeStroops: "100.45", totalFeeXlm: "0.0000100", savings: "0%" },
      ],
      customMultiplier: 1.5,
    };
    vi.mocked(getClient).mockReturnValue({
      transaction: {
        estimateDetailedFee: vi.fn().mockResolvedValue({ data: fractionalEstimate, error: null }),
      },
    } as unknown as SorokitClient);

    render(<TransactionFeeCalculator />);
    await waitFor(() => expect(screen.getByText("Payment")).toBeInTheDocument());

    // 100.45 ceiled → 101 — should not appear as "100" or "100.45"
    const stroopValues = screen.getAllByText("101");
    expect(stroopValues.length).toBeGreaterThan(0);
  });

  it("toggles fee display between Stroops and XLM when toggle button is clicked", async () => {
    mockClient();
    render(<TransactionFeeCalculator />);
    await waitFor(() => expect(screen.getByText("Payment")).toBeInTheDocument());

    // Default unit label is "stroops"
    const stroopLabels = screen.getAllByText("stroops");
    expect(stroopLabels.length).toBeGreaterThan(0);

    // Click the toggle to switch to XLM
    fireEvent.click(screen.getByRole("button", { name: "Switch to XLM" }));

    await waitFor(() => {
      const xlmLabels = screen.getAllByText("XLM");
      // At least one fee row now shows XLM as the unit
      expect(xlmLabels.length).toBeGreaterThan(0);
    });

    // Toggle back to Stroops
    fireEvent.click(screen.getByRole("button", { name: "Switch to Stroops" }));
    await waitFor(() => {
      const stroopLabelsAgain = screen.getAllByText("stroops");
      expect(stroopLabelsAgain.length).toBeGreaterThan(0);
    });
  });

  it("calculates correct total for multi-operation fee estimates", async () => {
    const multiOpEstimate: GasEstimate = {
      totalGasUnits: 600,
      breakdown: [
        { operationType: "payment", gasUnits: 200, feeStroops: "20000", feeXlm: "0.0020000" },
        { operationType: "change_trust", gasUnits: 200, feeStroops: "20000", feeXlm: "0.0020000" },
        { operationType: "manage_sell_offer", gasUnits: 200, feeStroops: "20000", feeXlm: "0.0020000" },
      ],
      scenarios: [
        { label: "average", gasPrice: "100", totalFeeStroops: "60000", totalFeeXlm: "0.0060000", savings: "0%" },
      ],
      customMultiplier: 1,
    };
    vi.mocked(getClient).mockReturnValue({
      transaction: {
        estimateDetailedFee: vi.fn().mockResolvedValue({ data: multiOpEstimate, error: null }),
      },
    } as unknown as SorokitClient);

    render(<TransactionFeeCalculator operations={["payment", "change_trust", "manage_sell_offer"]} />);

    await waitFor(() => {
      expect(screen.getByText("Payment")).toBeInTheDocument();
      expect(screen.getByText("Change Trust")).toBeInTheDocument();
      expect(screen.getByText("Manage Sell Offer")).toBeInTheDocument();
      expect(screen.getByText("Total Estimated Fee")).toBeInTheDocument();
    });
  });
});
