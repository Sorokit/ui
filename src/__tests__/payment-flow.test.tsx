import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
      },
    } as unknown as ReturnType<typeof getClient>;
    // TransactionPanel calls the module-level getClient(); wire it to the mock.
    initClient(mockClient);
  });

  const Wrapper = () => {
    const ConnectTrigger = () => {
      const { connectWallet } = useSorokit();
      return <button onClick={() => connectWallet()}>Test Connect</button>;
    };
    return (
      <SorokitProvider client={mockClient}>
        <TransactionPanel />
        <ConnectTrigger />
      </SorokitProvider>
    );
  };

  /** Renders the panel, connects the mock wallet, and waits for balances to load. */
  async function connectAndWait() {
    render(<Wrapper />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Test Connect" }));
    });
    await waitFor(() => {
      expect(screen.getByRole("option", { name: /XLM/ })).toHaveTextContent("100.5");
    });
  }

  it("submits payment with correct destination, amount, and source", async () => {
    await connectAndWait();

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
        source: mockAddress,
      }),
    );
  });

  // ── Muxed account payments (issue #968) ───────────────────────────────────

  describe("muxed account (M...) destinations", () => {
    // SEP-23 official test vector: the same base account, multiplexed with
    // ID 0.
    const MUXED_DEST =
      "MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAAACJUQ";

    it("accepts a 69-character muxed address as the destination and enables submit", async () => {
      await connectAndWait();

      fireEvent.change(screen.getByLabelText("Destination Address"), {
        target: { value: MUXED_DEST },
      });
      fireEvent.change(screen.getByLabelText("Amount (XLM)"), {
        target: { value: "10" },
      });

      expect(screen.getByTestId("submit-transaction")).not.toBeDisabled();
      // No validation error should be shown for a well-formed muxed address.
      expect(
        screen.queryByText(/stellar address must (start with|be)/i),
      ).not.toBeInTheDocument();
    });

    it("submits a payment to a muxed destination with the full M-address intact", async () => {
      await connectAndWait();

      fireEvent.change(screen.getByLabelText("Destination Address"), {
        target: { value: MUXED_DEST },
      });
      fireEvent.change(screen.getByLabelText("Amount (XLM)"), {
        target: { value: "10" },
      });
      fireEvent.click(screen.getByTestId("submit-transaction"));

      await waitFor(() => screen.getByRole("dialog", { name: /confirm transaction/i }));
      fireEvent.click(screen.getByRole("button", { name: /confirm & sign/i }));

      await waitFor(() => {
        expect(screen.getByText("Transaction submitted")).toBeInTheDocument();
      });

      // The muxed address is passed through to submission verbatim: nothing
      // strips the embedded sub-account ID down to the base G-address.
      expect(mockClient.transaction.submit).toHaveBeenCalledWith(
        expect.objectContaining({ destination: MUXED_DEST }),
      );
    });

    it("rejects a muxed address with a corrupted checksum", async () => {
      await connectAndWait();

      const corrupted = `${MUXED_DEST.slice(0, -1)}X`;
      fireEvent.change(screen.getByLabelText("Destination Address"), {
        target: { value: corrupted },
      });

      expect(screen.getByTestId("submit-transaction")).toBeDisabled();
    });
  });

  // ── MEMO_HASH / MEMO_RETURN validation (issue #968) ───────────────────────

  describe("MEMO_HASH and MEMO_RETURN memo types", () => {
    const VALID_HEX = "a".repeat(64);

    async function setUpValidPayment() {
      await connectAndWait();
      fireEvent.change(screen.getByLabelText("Destination Address"), {
        target: { value: "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ" },
      });
      fireEvent.change(screen.getByLabelText("Amount (XLM)"), {
        target: { value: "5" },
      });
    }

    it("accepts a well-formed 64-character hex MEMO_HASH and enables submit", async () => {
      await setUpValidPayment();
      fireEvent.change(screen.getByLabelText("Memo type"), { target: { value: "hash" } });
      fireEvent.change(screen.getByLabelText("Memo hash"), { target: { value: VALID_HEX } });

      expect(screen.getByTestId("submit-transaction")).not.toBeDisabled();
      expect(screen.queryByText(/must be a 64-character hex string/i)).not.toBeInTheDocument();
    });

    it("accepts a well-formed 64-character hex MEMO_RETURN and enables submit", async () => {
      await setUpValidPayment();
      fireEvent.change(screen.getByLabelText("Memo type"), { target: { value: "return" } });
      fireEvent.change(screen.getByLabelText("Memo return"), { target: { value: VALID_HEX } });

      expect(screen.getByTestId("submit-transaction")).not.toBeDisabled();
    });

    it("rejects a MEMO_HASH shorter than 64 characters and disables submit", async () => {
      await setUpValidPayment();
      fireEvent.change(screen.getByLabelText("Memo type"), { target: { value: "hash" } });
      fireEvent.change(screen.getByLabelText("Memo hash"), {
        target: { value: VALID_HEX.slice(0, 63) },
      });

      expect(screen.getByText(/must be a 64-character hex string/i)).toBeInTheDocument();
      expect(screen.getByTestId("submit-transaction")).toBeDisabled();
    });

    it("rejects a MEMO_HASH containing non-hex characters and disables submit", async () => {
      await setUpValidPayment();
      fireEvent.change(screen.getByLabelText("Memo type"), { target: { value: "hash" } });
      fireEvent.change(screen.getByLabelText("Memo hash"), {
        target: { value: `${"a".repeat(63)}g` }, // 'g' is not a hex digit
      });

      expect(screen.getByText(/must be a 64-character hex string/i)).toBeInTheDocument();
      expect(screen.getByTestId("submit-transaction")).toBeDisabled();
    });

    it("rejects an empty MEMO_HASH and disables submit", async () => {
      await setUpValidPayment();
      fireEvent.change(screen.getByLabelText("Memo type"), { target: { value: "hash" } });

      expect(screen.getByTestId("submit-transaction")).toBeDisabled();
    });

    it("submits with the exact hex memo and hash memo type", async () => {
      await setUpValidPayment();
      fireEvent.change(screen.getByLabelText("Memo type"), { target: { value: "hash" } });
      fireEvent.change(screen.getByLabelText("Memo hash"), { target: { value: VALID_HEX } });

      fireEvent.click(screen.getByTestId("submit-transaction"));
      await waitFor(() => screen.getByRole("dialog", { name: /confirm transaction/i }));
      fireEvent.click(screen.getByRole("button", { name: /confirm & sign/i }));

      await waitFor(() => {
        expect(screen.getByText("Transaction submitted")).toBeInTheDocument();
      });

      expect(mockClient.transaction.submit).toHaveBeenCalledWith(
        expect.objectContaining({ memoType: "hash", memo: VALID_HEX }),
      );
    });
  });

  // ── Underfunded (op_underfunded) recovery (issue #968) ────────────────────

  describe("underfunded payment recovery", () => {
    async function submitAndFailWithUnderfunded() {
      mockClient.transaction.submit = vi
        .fn()
        .mockResolvedValue({ data: null, error: "tx_failed: op_underfunded" });

      await connectAndWait();
      fireEvent.change(screen.getByLabelText("Destination Address"), {
        target: { value: "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ" },
      });
      fireEvent.change(screen.getByLabelText("Amount (XLM)"), {
        target: { value: "5" },
      });
      fireEvent.click(screen.getByTestId("submit-transaction"));

      await waitFor(() => screen.getByRole("dialog", { name: /confirm transaction/i }));
      fireEvent.click(screen.getByRole("button", { name: /confirm & sign/i }));

      await waitFor(() => {
        expect(screen.getByText("Transaction failed")).toBeInTheDocument();
      });
    }

    it("shows actionable guidance when submission fails with op_underfunded", async () => {
      await submitAndFailWithUnderfunded();

      // The actionable guidance friendlyError maps op_underfunded to, not
      // the raw Horizon error string.
      expect(
        screen.getByText(/insufficient balance to submit this transaction/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/add more xlm and try again/i)).toBeInTheDocument();
    });

    it("lets the user retry after an underfunded failure via New Transaction", async () => {
      await submitAndFailWithUnderfunded();

      fireEvent.click(screen.getByRole("button", { name: "New Transaction" }));

      expect(screen.getByLabelText("Destination Address")).toBeInTheDocument();
      expect(screen.queryByText("Transaction failed")).not.toBeInTheDocument();
    });
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
    const memoInput = screen.getByLabelText("Memo hash");
    fireEvent.change(memoInput, { target: { value: "not-a-valid-64-char-hex" } });
    expect(
      screen.getByText(/must be a 64-character hex string/i),
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
