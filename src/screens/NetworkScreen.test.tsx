import { act,render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { beforeEach,describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";

import { NetworkScreen } from "./NetworkScreen";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: "div",
  Loading01Icon: "div",
}));

const TESTNET_NETWORK = {
  name: "testnet" as const,
  passphrase: "Test SDF Network ; September 2015",
  rpcUrl: "https://soroban-testnet.stellar.org",
  horizonUrl: "https://horizon-testnet.stellar.org",
};

describe("NetworkScreen", () => {
  let switchNetwork: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    switchNetwork = vi.fn();
    vi.mocked(useSorokit).mockReturnValue({
      network: TESTNET_NETWORK,
      switchNetwork,
    } as unknown as ReturnType<typeof useSorokit>);

    // jsdom does not implement scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("renders the active network info section", () => {
    render(<NetworkScreen />);
    expect(screen.getByText("Active Network")).toBeInTheDocument();
    expect(screen.getByText("testnet")).toBeInTheDocument();
  });

  it("renders an Active badge on the currently active network card", () => {
    render(<NetworkScreen />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("does not render Active badge on inactive network cards", () => {
    render(<NetworkScreen />);
    // Only one Active badge should exist for testnet
    expect(screen.getAllByText("Active")).toHaveLength(1);
  });

  it("calls switchNetwork with the correct name when clicking a different network", () => {
    render(<NetworkScreen />);

    // Click the Mainnet card (not the active testnet)
    const mainnetButton = screen.getByRole("button", { name: /mainnet/i });
    fireEvent.click(mainnetButton);

    expect(switchNetwork).toHaveBeenCalledWith("mainnet");
  });

  it("does not call switchNetwork when clicking the already active network card", () => {
    render(<NetworkScreen />);

    // Testnet is the active network — clicking it should be a no-op
    const testnetButton = screen.getByRole("button", { name: /testnet/i });
    fireEvent.click(testnetButton);

    expect(switchNetwork).not.toHaveBeenCalled();
  });

  it("renders all four network cards", () => {
    render(<NetworkScreen />);
    expect(screen.getByText("Mainnet")).toBeInTheDocument();
    expect(screen.getByText("Testnet")).toBeInTheDocument();
    expect(screen.getByText("Futurenet")).toBeInTheDocument();
    expect(screen.getByText("Localnet")).toBeInTheDocument();
  });

  it("does not render the active info panel when network is null", () => {
    vi.mocked(useSorokit).mockReturnValue({
      network: null,
      switchNetwork,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<NetworkScreen />);
    expect(screen.queryByText("Active Network")).not.toBeInTheDocument();
  });

  it("applies focus-visible ring classes on network card buttons", () => {
    render(<NetworkScreen />);
    const buttons = screen.getAllByRole("button");
    // Card buttons have "rounded-xl" (copy-buttons in InfoCell have "rounded-md")
    const cardButtons = buttons.filter((b) =>
      b.className.includes("rounded-xl"),
    );
    expect(cardButtons).toHaveLength(4);
    cardButtons.forEach((btn) => {
      expect(btn.className).toContain("focus-visible:outline-none");
      expect(btn.className).toContain("focus-visible:ring-2");
      expect(btn.className).toContain("focus-visible:ring-brand");
    });
  });

  it("shows a spinner on the selected card while switching networks", async () => {
    let resolveSwitch: (v: { data: { name: string }; error: null }) => void;
    switchNetwork.mockReturnValue(
      new Promise((resolve) => {
        resolveSwitch = resolve;
      }),
    );

    render(<NetworkScreen />);

    // Click the Mainnet card (not active, so it triggers switch)
    fireEvent.click(screen.getByRole("button", { name: /mainnet/i }));

    // The spinner icon should appear on the mainnet card
    const mainnetCard = screen.getByRole("button", { name: /mainnet/i });
    expect(mainnetCard.querySelector(".animate-spin")).toBeInTheDocument();

    // Resolve the switch
    await act(async () => {
      resolveSwitch!({ data: { name: "mainnet" }, error: null });
    });
  });

  // #753 Verify estimateFee is not called twice when both FeeEstimator and GasOptimizer are rendered
  it("verifies the client fee method isn't called twice per tick when components are rendered together (#753)", async () => {
    vi.useFakeTimers();
    // Render both with a polling interval
    const { FeeEstimator } = await import("@/components/FeeEstimator");
    const { GasOptimizer } = await import("@/components/GasOptimizer");
    const { getClient } = await import("@/lib/client");
    
    // We need to mock the client properly to test this
    const estimateFee = vi.fn().mockResolvedValue({ data: { baseFee: "100", recommended: "200" } });
    vi.mocked(useSorokit).mockReturnValue({
      client: {
        transaction: {
          estimateFee,
          estimateDetailedFee: vi.fn().mockResolvedValue({ data: { breakdown: [], totalGasUnits: 0, scenarios: [] } }),
          getFeeScenarios: vi.fn().mockResolvedValue({ data: [] }),
        },
        network: {
          getGasPrice: vi.fn().mockResolvedValue({ data: {} }),
        }
      },
    } as any);

    render(
      <div>
        <FeeEstimator refreshInterval={5000} />
        <GasOptimizer refreshInterval={5000} />
      </div>
    );

    // Initial mount calls
    await vi.runOnlyPendingTimersAsync();
    
    const initialCount = estimateFee.mock.calls.length;
    
    // Advance 1 tick (5000ms)
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    
    // estimateFee should only increase by 1, even though both have refreshInterval=5000
    // Because they share useFeeData
    expect(estimateFee.mock.calls.length).toBeLessThanOrEqual(initialCount + 1);
    
    vi.useRealTimers();
  });
});
