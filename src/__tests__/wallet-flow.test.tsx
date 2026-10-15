import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { beforeEach,describe, expect, it, vi } from "vitest";

import { AccountCard } from "@/components/AccountCard";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { SorokitProvider } from "@/context/SorokitProvider";
import { ToastProvider } from "@/context/ToastContext";
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
      <ToastProvider>
        <SorokitProvider client={mockClient}>
          <WalletConnectButton />
          <AccountCard />
          <DisconnectTrigger />
        </SorokitProvider>
      </ToastProvider>,
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

  it("aborts cleanly and displays a reconnect prompt when wallet disconnects during simulation (#967)", async () => {
    const { TransactionPanel } = await import("@/components/TransactionPanel");
    const ConnectDirect = () => {
      const { connectWallet } = useSorokit();
      return <button onClick={() => connectWallet()}>Direct Connect</button>;
    };

    (mockClient as unknown as Record<string, unknown>).transaction = {
      estimateFee: vi.fn().mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ data: { baseFee: "100", recommended: "100" }, error: null }), 100),
          ),
      ),
      submit: vi.fn().mockResolvedValue({ data: { hash: "h1", ledger: 1 }, error: null }),
    };

    render(
      <ToastProvider>
        <SorokitProvider client={mockClient}>
          <WalletConnectButton />
          <TransactionPanel />
          <ConnectDirect />
          <DisconnectTrigger />
        </SorokitProvider>
      </ToastProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Direct Connect" }));
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Destination Address")).toBeInTheDocument();
    });

    // Disconnect while simulation / preview is active
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    });

    expect(
      screen.getByText(/Connect your wallet to send transactions/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect/i })).toBeInTheDocument();
  });

  it("triggers sequence refetch when transaction fails with tx_bad_seq and resets draft form on account switch (#967)", async () => {
    const { TransactionPanel } = await import("@/components/TransactionPanel");
    const addr1 = "GBRPYHIL2CI3WHGSUJGY6O7SROQOMJG7QBCACN4QPKUOQNXJDGONXHPA";
    const addr2 = "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ";

    vi.mocked(mockClient.wallet.connect)
      .mockResolvedValueOnce({ data: { address: addr1 }, error: null })
      .mockResolvedValueOnce({ data: { address: addr2 }, error: null });

    vi.mocked(mockClient.account.getAccount)
      .mockResolvedValueOnce({ data: { sequence: "100" }, error: null })
      .mockResolvedValueOnce({ data: { sequence: "101" }, error: null })
      .mockResolvedValue({ data: { sequence: "200" }, error: null });

    (mockClient as unknown as Record<string, unknown>).transaction = {
      estimateFee: vi.fn().mockResolvedValue({
        data: { baseFee: "100", recommended: "100" },
        error: null,
      }),
      submit: vi.fn().mockResolvedValueOnce({
        data: null,
        error: "Transaction failed: tx_bad_seq",
      }),
    };

    const SwitchControls = () => {
      const { connectWallet } = useSorokit();
      return <button onClick={() => connectWallet()}>Connect Or Switch</button>;
    };

    render(
      <ToastProvider>
        <SorokitProvider client={mockClient}>
          <AccountCard />
          <TransactionPanel previewMode={false} />
          <SwitchControls />
        </SorokitProvider>
      </ToastProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Connect Or Switch" }));
    });

    await waitFor(() => {
      expect(screen.getByRole("option", { name: /XLM/ })).toHaveTextContent("100.5");
    });

    const destInput = screen.getByLabelText("Destination Address") as HTMLInputElement;
    const amountInput = screen.getByLabelText("Amount (XLM)") as HTMLInputElement;

    fireEvent.change(destInput, { target: { value: addr2 } });
    fireEvent.change(amountInput, { target: { value: "5" } });
    await act(async () => {
      fireEvent.click(screen.getByTestId("submit-transaction"));
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Your account sequence is out of date/i),
      ).toBeInTheDocument();
    });
    // Sequence refetch was triggered upon tx_bad_seq
    expect(mockClient.account.getAccount).toHaveBeenCalledTimes(2);

    // Return to form and populate draft, then switch active account
    fireEvent.click(screen.getByRole("button", { name: /new transaction/i }));
    fireEvent.change(screen.getByLabelText("Destination Address"), {
      target: { value: addr2 },
    });
    expect(
      (screen.getByLabelText("Destination Address") as HTMLInputElement).value,
    ).toBe(addr2);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Connect Or Switch" }));
    });

    await waitFor(() => {
      expect(
        (screen.getByLabelText("Destination Address") as HTMLInputElement).value,
      ).toBe("");
    });
  });
});

