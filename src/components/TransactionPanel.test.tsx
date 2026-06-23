import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TransactionPanel } from "./TransactionPanel";
import { getClient } from "@/lib/client";
import { useSorokit } from "@/context/useSorokit";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

vi.mock("@/lib/client", () => ({
  getClient: vi.fn(),
}));

describe("TransactionPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSorokit).mockReturnValue({
      address: "GABC",
      isConnected: true,
    } as unknown as ReturnType<typeof useSorokit>);
  });

  it("handles loading, success, and error states", async () => {
    const mockSubmit = vi.fn().mockImplementation(() => {
      return new Promise(resolve => {
        setTimeout(() => resolve({ data: { hash: "txhash123", ledger: 100 }, error: null }), 50);
      });
    });

    vi.mocked(getClient).mockReturnValue({
      transaction: {
        submit: mockSubmit,
      },
    } as unknown as ReturnType<typeof getClient>);

    render(<TransactionPanel />);

    const destInput = screen.getByLabelText("Destination Address");
    const amountInput = screen.getByLabelText("Amount (XLM)");
    const submitBtn = screen.getByRole("button", { name: "Send Payment" });

    fireEvent.change(destInput, { target: { value: "GDEF" } });
    fireEvent.change(amountInput, { target: { value: "10" } });

    // Submit and check loading state
    fireEvent.click(submitBtn);
    expect(submitBtn).toBeDisabled();
    expect(screen.getByRole("button", { name: "Submitting…" })).toBeInTheDocument();

    // Check success state
    expect(await screen.findByText("Transaction submitted")).toBeInTheDocument();
    expect(screen.getByText("Ledger #100")).toBeInTheDocument();
    expect(screen.getByText("txhash123")).toBeInTheDocument();

    // Test "New Transaction" button resets state
    const newTxBtn = screen.getByRole("button", { name: "New Transaction" });
    fireEvent.click(newTxBtn);

    expect(screen.getByLabelText("Destination Address")).toHaveValue("");
    expect(screen.getByLabelText("Amount (XLM)")).toHaveValue(null);
  });

  it("handles error state", async () => {
    const mockSubmit = vi.fn().mockResolvedValue({ data: null, error: "Insufficient balance" });

    vi.mocked(getClient).mockReturnValue({
      transaction: {
        submit: mockSubmit,
      },
    } as unknown as ReturnType<typeof getClient>);

    render(<TransactionPanel />);

    fireEvent.change(screen.getByLabelText("Destination Address"), { target: { value: "GDEF" } });
    fireEvent.change(screen.getByLabelText("Amount (XLM)"), { target: { value: "10" } });
    
    fireEvent.click(screen.getByRole("button", { name: "Send Payment" }));

    expect(await screen.findByText("Transaction failed")).toBeInTheDocument();
    expect(screen.getByText("Insufficient balance")).toBeInTheDocument();
  });
});
