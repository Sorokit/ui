import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import { getClient } from "@/lib/client";

import { TransactionPanel } from "./TransactionPanel";

vi.mock("@/lib/client", () => ({
  getClient: vi.fn(),
}));

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

describe("TransactionPanel integration", () => {
  it("submits payment with correct payload", async () => {
    const mockSubmit = vi
      .fn()
      .mockResolvedValue({ data: { hash: "txhash", ledger: 1 }, error: null });
    const mockClient = {
      transaction: {
        submit: mockSubmit,
        estimateFee: vi
          .fn()
          .mockResolvedValue({
            data: { baseFee: "100", recommended: "100" },
            error: null,
          }),
      },
    };
    vi.mocked(getClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof getClient>,
    );

    (
      useSorokit as unknown as { mockReturnValue: (value: unknown) => void }
    ).mockReturnValue({
      isConnected: true,
      address: "GBRPYHIL2CI3WHGSUJGY6O7SROQOMJG7QBCACN4QPKUOQNXJDGONXHPA",
      client: mockClient,
      balances: [{ asset: "XLM", balance: "100" }],
      connectWallet: vi.fn(),
      disconnectWallet: vi.fn(),
      error: null,
      clearError: vi.fn(),
    });

    render(<TransactionPanel />);

    const destInput = screen.getByLabelText("Destination Address");
    const amountInput = screen.getByLabelText("Amount (XLM)");
    const submitBtn = screen.getByRole("button", { name: /Send (Payment|XLM|USDC)/i });

    fireEvent.change(destInput, {
      target: {
        value: "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ",
      },
    });
    fireEvent.change(amountInput, { target: { value: "10" } });
    fireEvent.click(submitBtn);

    await waitFor(() =>
      screen.getByRole("dialog", { name: /confirm transaction/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /confirm & sign/i }));

    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: expect.any(String),
        amount: expect.any(String),
        source: expect.any(String),
      }),
    );
  });
});
