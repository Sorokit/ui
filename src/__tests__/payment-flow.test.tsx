import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach,describe, expect, it, vi } from "vitest";

import { TransactionPanel } from "@/components/TransactionPanel";
import { SorokitProvider } from "@/context/SorokitProvider";
import { useSorokit } from "@/context/useSorokit";
import { getClient, initClient } from "@/lib/client";

describe("Payment Flow Integration", () => {
  let mockClient: ReturnType<typeof getClient>;
  const mockAddress = "GBRPYHIL2CI3WHGSUJGY6O7SROQOMJG7QBCACN4QPKUOQNXJDGONXHPA";

  beforeEach(() => {
    mockClient = {
      wallet: {
        connect: vi.fn().mockResolvedValue({ data: { address: mockAddress }, error: null }),
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
        // Delay resolution so the transient "Submitting…" loading state is observable.
        submit: vi.fn().mockImplementation(
          () =>
            new Promise((resolve) =>
              setTimeout(
                () => resolve({ data: { hash: "txhash123", ledger: 100 }, error: null }),
                50,
              ),
            ),
        ),
        estimateFee: vi.fn().mockResolvedValue({
          data: { baseFee: "100", recommended: "100" },
          error: null,
        }),
      }
    } as unknown as ReturnType<typeof getClient>;
    // TransactionPanel calls the module-level getClient(); wire it to the mock.
    initClient(mockClient);
  });

  it("submits payment with correct destination, amount, and source", async () => {
    // We render SorokitProvider, but we must "connect" it first to have an active address.
    // We can simulate this by calling client.wallet.connect() inside a wrapper, or we can just 
    // click a connect button if we add one.
    // Alternatively, SorokitProvider might just rely on the client.
    // Let's create a small component to trigger connection.
    const Wrapper = () => {
      return (
        <SorokitProvider client={mockClient}>
          <TransactionPanel />
          <ConnectTrigger />
        </SorokitProvider>
      );
    };

    const ConnectTrigger = () => {
      const { connectWallet } = useSorokit();
      return <button onClick={() => connectWallet()}>Test Connect</button>;
    };

    render(<Wrapper />);

    // Connect the wallet first so TransactionPanel doesn't show "Wallet not connected"
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Test Connect" }));
    });

    await waitFor(() => {
      expect(screen.getByRole("option", { name: /XLM/ })).toHaveTextContent("100.5");
    });

    const destInput = screen.getByLabelText("Destination Address");
    const amountInput = screen.getByLabelText("Amount (XLM)");
    const submitBtn = screen.getByRole("button", { name: /Send (Payment|XLM|USDC)/i });

    const validDest = "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ";
    const validAmount = "15.5";

    fireEvent.change(destInput, { target: { value: validDest } });
    fireEvent.change(amountInput, { target: { value: validAmount } });

    fireEvent.click(submitBtn);

    await waitFor(() => screen.getByRole("dialog", { name: /confirm transaction/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm & sign/i }));

    // Verify the transient signing state appears on the confirm modal (the
    // underlying page's own "Submitting…" button is aria-hidden by the
    // modal while it's open, so this is what's actually reachable/visible).
    expect(screen.getByRole("button", { name: /signing/i })).toBeInTheDocument();

    // Verify success state renders
    await waitFor(() => {
      expect(screen.getByText("Transaction submitted")).toBeInTheDocument();
      expect(screen.getByText("txhash123")).toBeInTheDocument();
    });

    // Most importantly, verify the mock client's transaction.submit was called with the correct parameters
    expect(mockClient.transaction.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: validDest,
        amount: validAmount,
        source: mockAddress
      })
    );
  });

  it("submits payment to a 69-character Muxed account (M...) with a valid 64-character MEMO_HASH (#968)", async () => {
    const ConnectTrigger = () => {
      const { connectWallet } = useSorokit();
      return <button onClick={() => connectWallet()}>Test Connect</button>;
    };

    render(
      <SorokitProvider client={mockClient}>
        <TransactionPanel />
        <ConnectTrigger />
      </SorokitProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Test Connect" }));
    });
    await waitFor(() => {
      expect(screen.getByRole("option", { name: /XLM/ })).toHaveTextContent("100.5");
    });

    const muxedDest =
      "MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAAACJUQ";
    const validHash = "a".repeat(64);

    fireEvent.change(screen.getByLabelText("Destination Address"), {
      target: { value: muxedDest },
    });
    fireEvent.change(screen.getByLabelText("Amount (XLM)"), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByLabelText("Memo type"), {
      target: { value: "hash" },
    });

    // Invalid hex memo blocks submission and shows validation message
    const memoInput = screen.getByLabelText("Memo Hash");
    fireEvent.change(memoInput, { target: { value: "not-a-valid-64-char-hex" } });
    expect(
      screen.getByText(/Memo hash must be a 64-character hexadecimal string/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId("submit-transaction")).toBeDisabled();

    // Valid 64-char hex memo enables submission
    fireEvent.change(memoInput, { target: { value: validHash } });
    const submitBtn = screen.getByTestId("submit-transaction");
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => screen.getByRole("dialog", { name: /confirm transaction/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm & sign/i }));

    await waitFor(() => {
      expect(screen.getByText("Transaction submitted")).toBeInTheDocument();
    });

    expect(mockClient.transaction.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: muxedDest,
        amount: "10",
        memoType: "hash",
        memo: validHash,
      }),
    );
  });

  it("displays actionable user guidance when a payment fails due to op_underfunded (#968)", async () => {
    vi.mocked(mockClient.transaction.submit).mockResolvedValueOnce({
      data: null,
      error: "Transaction failed with op_underfunded",
    });

    const ConnectTrigger = () => {
      const { connectWallet } = useSorokit();
      return <button onClick={() => connectWallet()}>Test Connect</button>;
    };

    render(
      <SorokitProvider client={mockClient}>
        <TransactionPanel />
        <ConnectTrigger />
      </SorokitProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Test Connect" }));
    });
    await waitFor(() => {
      expect(screen.getByRole("option", { name: /XLM/ })).toHaveTextContent("100.5");
    });

    fireEvent.change(screen.getByLabelText("Destination Address"), {
      target: { value: "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ" },
    });
    fireEvent.change(screen.getByLabelText("Amount (XLM)"), {
      target: { value: "12" },
    });
    fireEvent.click(screen.getByTestId("submit-transaction"));

    await waitFor(() => screen.getByRole("dialog", { name: /confirm transaction/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm & sign/i }));

    await waitFor(() => {
      expect(screen.getByText("Transaction failed")).toBeInTheDocument();
      expect(
        screen.getByText(/Insufficient balance to submit this transaction/i),
      ).toBeInTheDocument();
    });
  });
});

