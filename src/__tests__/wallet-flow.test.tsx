import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { beforeEach,describe, expect, it, vi } from "vitest";

import { AccountCard } from "@/components/AccountCard";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { SorokitProvider } from "@/context/SorokitProvider";
import { useSorokit } from "@/context/useSorokit";
import { getClient } from "@/lib/client";

function getWalletButton(name: RegExp | string) {
  const grid = screen.getByRole("grid", { name: /available wallets/i });
  return within(grid).getByRole("button", { name });
}

// The connected WalletConnectButton opens a management modal rather than
// exposing a direct "Disconnect" control, so drive disconnect through context.
const DisconnectTrigger = () => {
  const { disconnectWallet } = useSorokit();
  // Avoid the substring "connect" so it doesn't collide with the /connect/i query.
  return <button onClick={() => disconnectWallet()}>Test Sign Out</button>;
};

describe("Wallet Connect Flow Integration", () => {
  let mockClient: ReturnType<typeof getClient>;

  beforeEach(() => {
    mockClient = {
      wallet: {
        connect: vi.fn().mockResolvedValue({ data: { address: "GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890" }, error: null }),
        disconnect: vi.fn().mockResolvedValue(undefined),
      },
      account: {
        getAccount: vi.fn().mockResolvedValue({ data: { sequence: "123456789" }, error: null }),
        getBalances: vi.fn().mockResolvedValue({ data: [{ asset: "XLM", balance: "100.5" }], error: null }),
      },
      network: {
        getNetwork: vi.fn().mockResolvedValue({ data: { name: "mainnet" }, error: null }),
        switchNetwork: vi.fn().mockResolvedValue({ data: { name: "testnet" }, error: null }),
      },
    } as unknown as ReturnType<typeof getClient>;
  });

  it("connects wallet, displays account, and disconnects", async () => {
    render(
      <SorokitProvider client={mockClient}>
        <WalletConnectButton />
        <AccountCard />
        <DisconnectTrigger />
      </SorokitProvider>
    );

    // The mock address also ends in "123456789", so every sequence assertion is
    // anchored on the Sequence label instead of the bare number.
    const sequenceRow = () => screen.getByText(/^Sequence$/i).parentElement;

    // Initial state: Wallet not connected, AccountCard should not show sequence
    expect(screen.getByRole("button", { name: /connect/i })).toBeInTheDocument();
    expect(screen.queryByText(/^Sequence$/i)).not.toBeInTheDocument();

    // Action 1: Connect Wallet — opens the adapter-selection modal
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /connect/i }));
    });
    await waitFor(() =>
      screen.getByRole("dialog", { name: /connect a wallet/i }),
    );
    await act(async () => {
      fireEvent.click(getWalletButton(/Freighter/i));
    });

    // Verification 1: Wallet connected, AccountCard renders account data
    expect(mockClient.wallet.connect).toHaveBeenCalled();
    
    // Disconnect button should appear inside WalletConnectButton or similar if it toggles
    // We wait for the account data to be fetched and rendered in AccountCard
    await waitFor(() => {
      expect(sequenceRow()).toHaveTextContent("123456789"); // Sequence number
    });

    // Action 2: Disconnect Wallet (via context; connected button opens a modal instead)
    const disconnectBtn = screen.getByRole("button", { name: /sign out/i });
    await act(async () => {
      fireEvent.click(disconnectBtn);
    });

    // Verification 2: Wallet disconnected, AccountCard returns null (or clears data)
    expect(mockClient.wallet.disconnect).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /connect/i })).toBeInTheDocument();
    expect(screen.queryByText(/^Sequence$/i)).not.toBeInTheDocument();
  });
});
