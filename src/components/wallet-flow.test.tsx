import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";

import { AccountCard } from "./AccountCard";
import { WalletConnectButton } from "./WalletConnectButton";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

describe("Wallet flow integration", () => {
  const mockConnect = vi.fn();
  const mockClearError = vi.fn();
  const mockDisconnect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("connects, shows account, then opens wallet dropdown on click", async () => {
    (
      useSorokit as unknown as { mockReturnValue: (value: unknown) => void }
    ).mockReturnValue({
      isConnected: false,
      isConnecting: false,
      address: null,
      connectWallet: mockConnect,
      disconnectWallet: vi.fn(),
      error: null,
      clearError: mockClearError,
      network: null,
    });

    render(
      <>
        <WalletConnectButton />
        <AccountCard />
      </>,
    );

    expect(screen.getByText("Connect Wallet")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));
    await waitFor(() =>
      screen.getByRole("dialog", { name: /connect a wallet/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Freighter" }));
    expect(mockConnect).toHaveBeenCalledTimes(1);

    (
      useSorokit as unknown as { mockReturnValue: (value: unknown) => void }
    ).mockReturnValue({
      isConnected: true,
      isConnecting: false,
      address: "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      connectWallet: mockConnect,
      disconnectWallet: mockDisconnect,
      error: null,
      clearError: mockClearError,
      network: { name: "testnet" },
    });

    render(
      <>
        <WalletConnectButton />
        <AccountCard />
      </>,
    );

    expect(screen.getByText("GABC12...WXYZ")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Wallet connected/ }));
    await waitFor(() => {
      expect(screen.getByText("Disconnect")).toBeInTheDocument();
    });
    expect(screen.getByText("testnet")).toBeInTheDocument();
  });
});
