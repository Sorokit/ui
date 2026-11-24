import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TransactionPanel } from "@/components/TransactionPanel";
import { SorokitProvider } from "@/context/SorokitProvider";
import { useSorokit } from "@/context/useSorokit";
import { getClient, initClient } from "@/lib/client";

describe("Multi-Asset Payment Flow", () => {
  let mockClient: ReturnType<typeof getClient>;
  const mockAddress = "GBRPYHIL2CI3WHGSUJGY6O7SROQOMJG7QBCACN4QPKUOQNXJDGONXHPA";
  const validDest = "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ";
  const usdcIssuer = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    mockClient = {
      wallet: {
        connect: vi.fn().mockResolvedValue({ data: { address: mockAddress }, error: null }),
        disconnect: vi.fn().mockResolvedValue(undefined),
      },
      account: {
        getAccount: vi.fn().mockResolvedValue({ data: { sequence: "123456789" }, error: null }),
        getBalances: vi.fn().mockResolvedValue({
          data: [
            { asset: "XLM", balance: "1000.0000000", assetType: "native" },
            { asset: "USDC", balance: "500.0000000", assetType: "credit_alphanum4", assetIssuer: usdcIssuer },
          ],
          error: null,
        }),
      },
      network: {
        getNetwork: vi.fn().mockResolvedValue({ data: { name: "testnet" }, error: null }),
        switchNetwork: vi.fn().mockResolvedValue({ data: { name: "testnet" }, error: null }),
      },
      transaction: {
        submit: vi.fn().mockResolvedValue({
          data: { hash: "txhash_mock_asset", ledger: 12345, successful: true },
          error: null,
          status: "success",
        }),
        estimateFee: vi.fn().mockResolvedValue({
          data: { baseFee: "100", recommended: "100" },
          error: null,
        }),
      },
    } as unknown as ReturnType<typeof getClient>;

    initClient(mockClient);
  });

  const Wrapper = () => {
    const ConnectTrigger = () => {
      const { connectWallet } = useSorokit();
      return <button onClick={() => connectWallet()}>Connect</button>;
    };
    return (
      <SorokitProvider client={mockClient}>
        <TransactionPanel />
        <ConnectTrigger />
      </SorokitProvider>
    );
  };

  async function connectWalletAndWait() {
    render(<Wrapper />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    });
    await waitFor(() => {
      expect(screen.getByRole("option", { name: /XLM/ })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: /USDC/ })).toBeInTheDocument();
    });
  }

  it("sends XLM then USDC sequentially in one session", async () => {
    await connectWalletAndWait();

    // 1. Send XLM payment
    const destInput = screen.getByLabelText("Destination Address");
    const amountInput = screen.getByLabelText("Amount (XLM)");
    const submitBtn = screen.getByRole("button", { name: "Send XLM" });

    fireEvent.change(destInput, { target: { value: validDest } });
    fireEvent.change(amountInput, { target: { value: "25" } });
    fireEvent.click(submitBtn);

    await waitFor(() => screen.getByRole("dialog", { name: /confirm transaction/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm & sign/i }));

    await waitFor(() => {
      expect(screen.getByText("Transaction submitted")).toBeInTheDocument();
    });

    expect(mockClient.transaction.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: validDest,
        amount: "25",
        asset: "XLM",
        source: mockAddress,
      }),
    );

    // Reset form
    fireEvent.click(screen.getByRole("button", { name: "New Transaction" }));

    // 2. Send USDC payment
    await waitFor(() => {
      expect(screen.getByLabelText("Asset")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Asset"), { target: { value: "USDC" } });

    await waitFor(() => {
      expect(screen.getByLabelText("Amount (USDC)")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Destination Address"), { target: { value: validDest } });
    fireEvent.change(screen.getByLabelText("Amount (USDC)"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Send USDC" }));

    await waitFor(() => screen.getByRole("dialog", { name: /confirm transaction/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm & sign/i }));

    await waitFor(() => {
      expect(screen.getByText("Transaction submitted")).toBeInTheDocument();
    });

    expect(mockClient.transaction.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: validDest,
        amount: "10",
        asset: "USDC",
        assetIssuer: usdcIssuer,
        source: mockAddress,
      }),
    );

    // Total submit calls should be 2
    expect(mockClient.transaction.submit).toHaveBeenCalledTimes(2);
  });

  it("handles multi-send with different assets across rows", async () => {
    await connectWalletAndWait();

    // Switch to Multi-Send tab
    fireEvent.click(screen.getByRole("tab", { name: /Multi-Send/i }));

    await waitFor(() => {
      expect(screen.getByTestId("multi-send-dest-0")).toBeInTheDocument();
    });

    // Row 0: XLM
    fireEvent.change(screen.getByTestId("multi-send-dest-0"), { target: { value: validDest } });
    fireEvent.change(screen.getByTestId("multi-send-amount-0"), { target: { value: "15" } });
    fireEvent.change(screen.getByTestId("multi-send-asset-0"), { target: { value: "XLM" } });

    // Row 1: USDC
    fireEvent.change(screen.getByTestId("multi-send-dest-1"), { target: { value: validDest } });
    fireEvent.change(screen.getByTestId("multi-send-amount-1"), { target: { value: "30" } });
    fireEvent.change(screen.getByTestId("multi-send-asset-1"), { target: { value: "USDC" } });

    // Submit batch
    const batchBtn = screen.getByTestId("submit-batch");
    expect(batchBtn).not.toBeDisabled();
    fireEvent.click(batchBtn);

    await waitFor(() => {
      expect(screen.getByTestId("batch-all-success-alert")).toBeInTheDocument();
      expect(screen.getByText(/All Payments Sent/i)).toBeInTheDocument();
    });

    expect(mockClient.transaction.submit).toHaveBeenCalledTimes(2);
    expect(mockClient.transaction.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: validDest,
        amount: "15",
        asset: "XLM",
      }),
    );
    expect(mockClient.transaction.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: validDest,
        amount: "30",
        asset: "USDC",
        assetIssuer: usdcIssuer,
      }),
    );
  });

  /**
   * Test suite for edge cases in multi-asset payment flows.
   * Addresses issue #1104: Verify multi-asset payments handle edge cases gracefully.
   */
  describe("Multi-asset payment edge cases", () => {
    it("handles insufficient balance for selected asset", async () => {
      const insufficientClient = {
        ...mockClient,
        account: {
          ...mockClient.account,
          getBalances: vi.fn().mockResolvedValue({
            data: [
              { asset: "XLM", balance: "0.0000001", assetType: "native" },
              { asset: "USDC", balance: "500.0000000", assetType: "credit_alphanum4", assetIssuer: usdcIssuer },
            ],
            error: null,
          }),
        },
      } as unknown as ReturnType<typeof getClient>;

      initClient(insufficientClient);
      await connectWalletAndWait();

      const amountInput = screen.getByLabelText("Amount (XLM)");
      fireEvent.change(amountInput, { target: { value: "1000" } });

      await waitFor(() => {
        expect(screen.getByText(/insufficient balance/i)).toBeInTheDocument();
      });

      expect(screen.getByRole("button", { name: /Send XLM/i })).toBeDisabled();
    });

    it("validates asset-specific decimal precision requirements", async () => {
      await connectWalletAndWait();

      // Switch to USDC (typically 6 decimals)
      fireEvent.change(screen.getByLabelText("Asset"), { target: { value: "USDC" } });

      await waitFor(() => {
        expect(screen.getByLabelText("Amount (USDC)")).toBeInTheDocument();
      });

      // Try to enter 7+ decimals (should fail or be truncated)
      fireEvent.change(screen.getByLabelText("Amount (USDC)"), { target: { value: "10.1234567" } });

      await waitFor(() => {
        expect(screen.getByText(/too many decimal places/i)).toBeInTheDocument();
      });
    });

    it("prevents submission when any multi-send row has validation errors", async () => {
      await connectWalletAndWait();

      fireEvent.click(screen.getByRole("tab", { name: /Multi-Send/i }));

      await waitFor(() => {
        expect(screen.getByTestId("multi-send-dest-0")).toBeInTheDocument();
      });

      // Row 0: Valid
      fireEvent.change(screen.getByTestId("multi-send-dest-0"), { target: { value: validDest } });
      fireEvent.change(screen.getByTestId("multi-send-amount-0"), { target: { value: "10" } });

      // Row 1: Invalid destination
      fireEvent.change(screen.getByTestId("multi-send-dest-1"), { target: { value: "INVALID_ADDRESS" } });
      fireEvent.change(screen.getByTestId("multi-send-amount-1"), { target: { value: "20" } });

      const batchBtn = screen.getByTestId("submit-batch");
      expect(batchBtn).toBeDisabled();

      // Fix the invalid destination
      fireEvent.change(screen.getByTestId("multi-send-dest-1"), { target: { value: validDest } });

      // Now submit button should be enabled
      await waitFor(() => {
        expect(batchBtn).not.toBeDisabled();
      });
    });
  });
});

