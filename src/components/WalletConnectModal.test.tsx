import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import { getClient } from "@/lib/client";

import { WalletConnectModal } from "./WalletConnectModal";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

function mockUseSorokit(overrides: Partial<ReturnType<typeof useSorokit>> = {}) {
  return {
    get client() { return getClient(); },
    address: null,
    isConnected: false,
    isConnecting: false,
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
    ...overrides,
  };
}

describe("WalletConnectModal", () => {
  const mockConnect = vi.fn();
  const mockClearError = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    vi.mocked(useSorokit).mockReturnValue(mockUseSorokit());
    render(<WalletConnectModal open={false} onClose={mockOnClose} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the adapter selection grid when open", () => {
    vi.mocked(useSorokit).mockReturnValue(mockUseSorokit());
    render(<WalletConnectModal open={true} onClose={mockOnClose} />);
    expect(screen.getByRole("dialog", { name: /connect a wallet/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Freighter" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "xBull" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lobstr" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Albedo" })).toBeInTheDocument();
  });

  it("supports a custom wallet option list", () => {
    vi.mocked(useSorokit).mockReturnValue(mockUseSorokit());
    render(
      <WalletConnectModal
        open={true}
        onClose={mockOnClose}
        walletOptions={[{ id: "rabet", name: "Rabet", initial: "R", color: "#000" }]}
      />,
    );
    expect(screen.getByRole("button", { name: "Rabet" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Freighter" })).not.toBeInTheDocument();
  });

  it("calls connectWallet and shows a connecting state when a wallet is selected", () => {
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokit({ connectWallet: mockConnect, isConnecting: true }),
    );
    render(<WalletConnectModal open={true} onClose={mockOnClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Freighter" }));

    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent(/waiting for freighter approval/i);
  });

  it("shows a success screen with the connected address once connecting finishes", async () => {
    const address = "GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOP";
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokit({ connectWallet: mockConnect, isConnecting: false, address }),
    );
    render(<WalletConnectModal open={true} onClose={mockOnClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Freighter" }));

    await waitFor(() =>
      expect(screen.getByRole("dialog", { name: /connected/i })).toBeInTheDocument(),
    );
    expect(screen.getByText(/GABCDE/)).toBeInTheDocument();
  });

  it("shows an error screen with a retry action once connecting fails", async () => {
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokit({
        connectWallet: mockConnect,
        isConnecting: false,
        error: "Connection rejected by user",
        clearError: mockClearError,
      }),
    );
    render(<WalletConnectModal open={true} onClose={mockOnClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Freighter" }));

    await waitFor(() =>
      expect(screen.getByRole("dialog", { name: /connection failed/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Connection rejected by user");

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(mockClearError).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog", { name: /connect a wallet/i })).toBeInTheDocument();
  });

  it("shows install guidance for a 'not found' style error", async () => {
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokit({
        connectWallet: mockConnect,
        isConnecting: false,
        error: "No Stellar wallet found. Install Freighter, xBull, or Albedo.",
      }),
    );
    render(<WalletConnectModal open={true} onClose={mockOnClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Freighter" }));

    await waitFor(() =>
      expect(screen.getByText(/install the freighter browser extension/i)).toBeInTheDocument(),
    );
  });

  it("calls onClose when the close button is clicked", () => {
    vi.mocked(useSorokit).mockReturnValue(mockUseSorokit());
    render(<WalletConnectModal open={true} onClose={mockOnClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Done is clicked on the success screen", async () => {
    const address = "GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOP";
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokit({ connectWallet: mockConnect, isConnecting: false, address }),
    );
    render(<WalletConnectModal open={true} onClose={mockOnClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Freighter" }));
    await waitFor(() => screen.getByRole("button", { name: "Done" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
