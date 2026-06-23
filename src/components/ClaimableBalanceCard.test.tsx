import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClaimableBalanceCard } from "./ClaimableBalanceCard";
import { getClient } from "@/lib/client";
import { useSorokit } from "@/context/useSorokit";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

vi.mock("@/lib/client", () => ({
  getClient: vi.fn(),
}));

describe("ClaimableBalanceCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders an error message and re-enables button on claim failure, shows Claimed badge on success", async () => {
    vi.mocked(useSorokit).mockReturnValue({
      address: "GABC123",
      isConnected: true,
    } as unknown as ReturnType<typeof useSorokit>);

    const mockClaimBalance = vi.fn()
      .mockResolvedValueOnce({ data: null, error: "Network error" }) // Failure first
      .mockResolvedValueOnce({ data: { hash: "tx123" }, error: null }); // Success second

    const mockGetClaimableBalances = vi.fn().mockResolvedValue({
      data: [
        {
          id: "cb1",
          asset: "XLM:GABC",
          amount: "10.0",
          sponsor: "GDEF",
          claimants: [],
        },
      ],
      error: null,
    });

    vi.mocked(getClient).mockReturnValue({
      account: {
        getClaimableBalances: mockGetClaimableBalances,
        claimBalance: mockClaimBalance,
      },
    } as unknown as ReturnType<typeof getClient>);

    render(<ClaimableBalanceCard />);

    // Wait for the balance to load
    expect(await screen.findByText("10.00")).toBeInTheDocument();

    const claimButton = screen.getByRole("button", { name: "Claim" });
    
    // Simulate first click: Failure
    fireEvent.click(claimButton);
    
    // Wait for error to show up
    expect(await screen.findByText("Network error")).toBeInTheDocument();
    expect(claimButton).not.toBeDisabled(); // Should re-enable

    // Simulate second click: Success
    fireEvent.click(claimButton);
    
    // Wait for "Claimed" badge
    expect(await screen.findByText("Claimed")).toBeInTheDocument();
    
    // Button should be gone after claim
    expect(screen.queryByRole("button", { name: "Claim" })).not.toBeInTheDocument();
    // Error should be gone
    expect(screen.queryByText("Network error")).not.toBeInTheDocument();
  });
});
