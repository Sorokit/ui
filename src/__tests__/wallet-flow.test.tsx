import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { beforeEach,describe, expect, it, vi } from "vitest";

import { AccountCard } from "@/components/AccountCard";
import { SorobanPanel } from "@/components/SorobanPanel";
import { TransactionPanel } from "@/components/TransactionPanel";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { SorokitProvider } from "@/context/SorokitProvider";
import { ToastProvider } from "@/context/ToastContext";
import { useSorokit } from "@/context/useSorokit";
import { getClient } from "@/lib/client";

function getWalletButton(name: RegExp | string) {
  const container =
    screen.queryByRole("radiogroup", { name: /available wallets/i }) ??
    screen.getByRole("grid", { name: /available wallets/i });
  return (
    within(container).queryByRole("radio", { name }) ??
    within(container).getByRole("button", { name })
  );
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
      transaction: {
        submit: vi.fn().mockResolvedValue({ data: { hash: "abc" }, error: null, status: "success" }),
        estimateFee: vi.fn().mockResolvedValue({
          data: { baseFee: "100", recommended: "100" },
          error: null,
        }),
      },
      soroban: {
        invokeContract: vi.fn(),
        simulateContract: vi.fn(),
        getEvents: vi.fn().mockResolvedValue({ data: [], error: null }),
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

  // ── Wallet disconnect during an in-flight simulation (#967) ─────────────
  it("aborts a pending contract simulation and shows a reconnect prompt if the wallet disconnects mid-flight", async () => {
    let resolveSimulate: (v: { data: unknown; error: string | null; status: string }) => void =
      () => {};
    mockClient.soroban = {
      invokeContract: vi.fn(),
      simulateContract: vi.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveSimulate = resolve;
        }),
      ),
      getEvents: vi.fn().mockResolvedValue({ data: [], error: null }),
    } as unknown as ReturnType<typeof getClient>["soroban"];

    render(
      <ToastProvider>
        <SorokitProvider client={mockClient}>
          <WalletConnectButton />
          <DisconnectTrigger />
          <SorobanPanel
            contractId="CCONTRACT123"
            onContractIdChange={() => {}}
            mode="simulate"
          />
        </SorokitProvider>
      </ToastProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /connect/i }));
    });
    await waitFor(() => screen.getByRole("dialog", { name: /connect a wallet/i }));
    await act(async () => {
      fireEvent.click(getWalletButton(/Freighter/i));
    });
    await waitFor(() => expect(mockClient.wallet.connect).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText("Method"), {
      target: { value: "balance" },
    });
    fireEvent.click(screen.getByRole("button", { name: /simulate/i }));

    // The simulate call is now in flight (deliberately never resolved yet).
    expect(screen.getByRole("status", { name: /simulating contract/i })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    });

    // Disconnecting while the simulate call is pending aborts it and shows a
    // reconnect prompt instead of the loading spinner or a generic error.
    expect(screen.queryByRole("status", { name: /simulating contract/i })).not.toBeInTheDocument();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/disconnected/i);
    expect(screen.getByRole("button", { name: /reconnect wallet/i })).toBeInTheDocument();

    // Resolving the stale promise afterwards must not resurrect a result —
    // the panel already moved past this request.
    await act(async () => {
      resolveSimulate({ data: { ok: true }, error: null, status: "success" });
    });
    expect(screen.queryByText("Simulation Result")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reconnect wallet/i })).toBeInTheDocument();
  });

  // ── Sequence desync auto-refetch (#967) ─────────────────────────────────
  it("refetches the account sequence automatically after a tx_bad_seq submission error", async () => {
    mockClient.transaction = {
      submit: vi.fn().mockResolvedValue({
        data: null,
        error: "tx_bad_seq",
        status: "error",
      }),
      estimateFee: vi.fn().mockResolvedValue({
        data: { baseFee: "100", recommended: "100" },
        error: null,
      }),
    } as unknown as ReturnType<typeof getClient>["transaction"];

    const getAccountMock = mockClient.account.getAccount as ReturnType<typeof vi.fn>;

    render(
      <ToastProvider>
        <SorokitProvider client={mockClient}>
          <WalletConnectButton />
          <TransactionPanel previewMode={false} />
        </SorokitProvider>
      </ToastProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /connect/i }));
    });
    await waitFor(() => screen.getByRole("dialog", { name: /connect a wallet/i }));
    await act(async () => {
      fireEvent.click(getWalletButton(/Freighter/i));
    });
    await waitFor(() => expect(mockClient.wallet.connect).toHaveBeenCalled());
    // Wait for the connected account/balances to finish loading so the
    // amount field's balance check doesn't disable the Send button.
    await waitFor(() => expect(getAccountMock).toHaveBeenCalled());

    // getAccount was already called once on connect; isolate the post-submit call.
    getAccountMock.mockClear();

    fireEvent.change(screen.getByLabelText(/destination/i), {
      target: { value: "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ" },
    });
    fireEvent.change(screen.getByLabelText(/^amount/i), {
      target: { value: "5" },
    });

    await waitFor(() => {
      expect(screen.getByTestId("submit-transaction")).not.toBeDisabled();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("submit-transaction"));
    });

    await waitFor(() => {
      expect(screen.getByText(/sequence is out of date/i)).toBeInTheDocument();
    });
    // A stale sequence is auto-recoverable: the panel refetches the account
    // instead of leaving the user to manually refresh elsewhere.
    expect(getAccountMock).toHaveBeenCalled();
  });

  // ── Account switch resets the draft transaction form (#967) ────────────
  it("clears the draft payment form when the connected account changes", async () => {
    const connectMock = mockClient.wallet.connect as ReturnType<typeof vi.fn>;
    connectMock
      .mockResolvedValueOnce({
        data: { address: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJEKDI" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { address: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB4U5H" },
        error: null,
      });

    render(
      <ToastProvider>
        <SorokitProvider client={mockClient}>
          <WalletConnectButton />
          <DisconnectTrigger />
          <TransactionPanel previewMode={false} />
        </SorokitProvider>
      </ToastProvider>,
    );

    // Connect as the first account and fill in a draft.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /connect/i }));
    });
    await waitFor(() => screen.getByRole("dialog", { name: /connect a wallet/i }));
    await act(async () => {
      fireEvent.click(getWalletButton(/Freighter/i));
    });
    await waitFor(() => expect(connectMock).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText(/destination/i), {
      target: { value: "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ" },
    });
    fireEvent.change(screen.getByLabelText(/^amount/i), {
      target: { value: "42" },
    });
    expect(screen.getByLabelText(/destination/i)).toHaveValue(
      "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ",
    );
    expect(screen.getByLabelText(/^amount/i)).toHaveValue(42);

    // Switch accounts: disconnect, then reconnect as a different address.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /connect/i }));
    });
    await waitFor(() => screen.getByRole("dialog", { name: /connect a wallet/i }));
    await act(async () => {
      fireEvent.click(getWalletButton(/Freighter/i));
    });
    await waitFor(() => expect(connectMock).toHaveBeenCalledTimes(2));

    // The draft from the previous account must not survive the switch.
    expect(screen.getByLabelText(/destination/i)).toHaveValue("");
    expect(screen.getByLabelText(/^amount/i)).toHaveValue(null);
  });
});
