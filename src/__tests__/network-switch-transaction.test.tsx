import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TransactionPanel } from "@/components/TransactionPanel";
import { SorokitProvider } from "@/context/SorokitProvider";
import { useSorokit } from "@/context/useSorokit";
import { getClient, initClient } from "@/lib/client";

const SOURCE_ADDRESS = "GBRPYHIL2CI3WHGSUJGY6O7SROQOMJG7QBCACN4QPKUOQNXJDGONXHPA";
const VALID_DESTINATION = "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ";

describe("Network switching mid-transaction integration tests (#1166)", () => {
  let mockClient: ReturnType<typeof getClient>;
  let resolveSubmitPromise: ((val: unknown) => void) | null = null;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resolveSubmitPromise = null;

    mockClient = {
      wallet: {
        connect: vi.fn().mockResolvedValue({ data: { address: SOURCE_ADDRESS }, error: null }),
        disconnect: vi.fn().mockResolvedValue(undefined),
      },
      account: {
        getAccount: vi.fn().mockResolvedValue({ data: { sequence: "12345" }, error: null }),
        getBalances: vi.fn().mockResolvedValue({
          data: [{ asset: "XLM", balance: "1000.0000000" }],
          error: null,
        }),
      },
      network: {
        getNetwork: vi.fn().mockResolvedValue({ data: { name: "testnet" }, error: null }),
        switchNetwork: vi.fn().mockImplementation((target: string) =>
          Promise.resolve({ data: { name: target }, error: null }),
        ),
      },
      transaction: {
        submit: vi.fn().mockImplementation(
          () =>
            new Promise((resolve) => {
              resolveSubmitPromise = resolve;
            }),
        ),
        estimateFee: vi.fn().mockResolvedValue({
          data: { baseFee: "100", recommended: "100" },
          error: null,
        }),
      },
    } as unknown as ReturnType<typeof getClient>;

    initClient(mockClient);
  });

  function TestHarness({ previewMode = false }: { previewMode?: boolean }) {
    const { connectWallet, switchNetwork } = useSorokit();
    return (
      <div>
        <button onClick={() => void connectWallet()}>Connect</button>
        <button onClick={() => void switchNetwork("mainnet")}>Switch to Mainnet</button>
        <TransactionPanel previewMode={previewMode} />
      </div>
    );
  }

  it("gracefully cancels in-flight transaction and resets state when network switches", async () => {
    render(
      <SorokitProvider client={mockClient}>
        <TestHarness previewMode={false} />
      </SorokitProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Destination Address")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Destination Address"), {
      target: { value: VALID_DESTINATION },
    });
    fireEvent.change(screen.getByLabelText("Amount (XLM)"), {
      target: { value: "50" },
    });

    fireEvent.click(screen.getByTestId("submit-transaction"));

    await waitFor(() => {
      expect(screen.getByText("Submitting…")).toBeInTheDocument();
    });

    // Mid-transaction, network switch triggered
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Switch to Mainnet" }));
    });

    // Verifies network switch was handled gracefully and transaction state reset
    await waitFor(() => {
      expect(
        screen.getByText(/Transaction cancelled due to network switch/i),
      ).toBeInTheDocument();
    });

    expect(screen.queryByText("Submitting…")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Transaction" })).toBeInTheDocument();

    // Resolving late after abort does not cause unhandled state update or success
    if (resolveSubmitPromise) {
      resolveSubmitPromise({
        data: { hash: "late-tx-hash", ledger: 9999 },
        error: null,
      });
    }

    // Reset back to idle form
    fireEvent.click(screen.getByRole("button", { name: "New Transaction" }));
    expect(screen.getByTestId("submit-transaction")).toBeInTheDocument();
  });

  it("closes confirmation modal and resets state when network switches during preview", async () => {
    render(
      <SorokitProvider client={mockClient}>
        <TestHarness previewMode={true} />
      </SorokitProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Destination Address")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Destination Address"), {
      target: { value: VALID_DESTINATION },
    });
    fireEvent.change(screen.getByLabelText("Amount (XLM)"), {
      target: { value: "25" },
    });

    fireEvent.click(screen.getByTestId("submit-transaction"));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: /confirm transaction/i })).toBeInTheDocument();
    });

    // Network switches while confirmation modal is open
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Switch to Mainnet", hidden: true }),
      );
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /confirm transaction/i })).not.toBeInTheDocument();
    });
  });

  it("cancels multi-send batch execution and resets state on network switch", async () => {
    render(
      <SorokitProvider client={mockClient}>
        <TestHarness previewMode={false} />
      </SorokitProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("tab-multi-send")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("tab-multi-send"));

    const destInputs = screen.getAllByPlaceholderText("G...");
    const amountInputs = screen.getAllByPlaceholderText("0.00");

    fireEvent.change(destInputs[0], { target: { value: VALID_DESTINATION } });
    fireEvent.change(amountInputs[0], { target: { value: "10" } });

    const secondDest = "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ";
    fireEvent.change(destInputs[1], { target: { value: secondDest } });
    fireEvent.change(amountInputs[1], { target: { value: "20" } });

    fireEvent.click(screen.getByTestId("submit-batch"));

    await waitFor(() => {
      expect(screen.getByText("Sending Batch…")).toBeInTheDocument();
    });

    // Network switch mid-batch
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Switch to Mainnet" }));
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Transaction cancelled due to network switch/i),
      ).toBeInTheDocument();
    });

    expect(screen.queryByText("Sending Batch…")).not.toBeInTheDocument();
  });

  /**
   * Test suite for state consistency during rapid network switches.
   * Addresses issue #1089: Verify network state remains consistent during rapid switches.
   */
  describe("Rapid network switching edge cases", () => {
    it("handles sequential rapid network switches without state corruption", async () => {
      render(
        <SorokitProvider client={mockClient}>
          <TestHarness previewMode={false} />
        </SorokitProvider>,
      );

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Connect" }));
      });

      await waitFor(() => {
        expect(screen.getByLabelText("Destination Address")).toBeInTheDocument();
      });

      // Perform multiple rapid switches
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Switch to Mainnet" }));
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Switch to Mainnet" }));
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Switch to Mainnet" }));
      });

      // Verify the UI remains stable and functional
      await waitFor(() => {
        expect(mockClient.network.switchNetwork).toHaveBeenCalled();
      });

      expect(screen.getByRole("button", { name: "Connect" })).toBeInTheDocument();
    });
  });
});
