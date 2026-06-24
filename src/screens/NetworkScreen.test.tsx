import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NetworkScreen } from "./NetworkScreen";
import { useSorokit } from "@/context/useSorokit";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
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
});
