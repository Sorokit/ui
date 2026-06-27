import { fireEvent,render, screen } from "@testing-library/react";
import { beforeEach,describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import { getClient } from "@/lib/client";

import { ClaimableBalanceCard } from "./ClaimableBalanceCard";

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

  it("shows prompt to connect wallet when not connected", () => {
    vi.mocked(useSorokit).mockReturnValue({
      address: null,
      isConnected: false,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<ClaimableBalanceCard />);
    expect(screen.getByText(/connect your wallet/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Claim" })).not.toBeInTheDocument();
  });

  it("shows fetch error when getClaimableBalances returns an error", async () => {
    vi.mocked(useSorokit).mockReturnValue({
      address: "GABC123",
      isConnected: true,
    } as unknown as ReturnType<typeof useSorokit>);

    vi.mocked(getClient).mockReturnValue({
      account: {
        getClaimableBalances: vi.fn().mockResolvedValue({
          data: null,
          error: "Failed to fetch balances",
        }),
        claimBalance: vi.fn(),
      },
    } as unknown as ReturnType<typeof getClient>);

    render(<ClaimableBalanceCard />);
    expect(await screen.findByText("Failed to fetch balances")).toBeInTheDocument();
  });

  it("shows empty state when no claimable balances exist", async () => {
    vi.mocked(useSorokit).mockReturnValue({
      address: "GABC123",
      isConnected: true,
    } as unknown as ReturnType<typeof useSorokit>);

    vi.mocked(getClient).mockReturnValue({
      account: {
        getClaimableBalances: vi.fn().mockResolvedValue({ data: [], error: null }),
        claimBalance: vi.fn(),
      },
    } as unknown as ReturnType<typeof getClient>);

    render(<ClaimableBalanceCard />);
    expect(await screen.findByText(/no claimable balances/i)).toBeInTheDocument();
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
