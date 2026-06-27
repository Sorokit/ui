import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BalanceList } from "./BalanceList";
import { useSorokit } from "@/context/useSorokit";

vi.mock("@/context/useSorokit", () => ({ useSorokit: vi.fn() }));

const base = {
  isConnected: false,
  isLoadingAccount: false,
  balances: [],
} as unknown as ReturnType<typeof useSorokit>;

beforeEach(() => vi.clearAllMocks());

describe("BalanceList", () => {
  it("shows connect prompt when not connected", () => {
    vi.mocked(useSorokit).mockReturnValue(base);
    render(<BalanceList />);
    expect(screen.getByText(/connect your wallet/i)).toBeInTheDocument();
  });

  it("shows skeletons while loading", () => {
    vi.mocked(useSorokit).mockReturnValue({
      ...base,
      isConnected: true,
      isLoadingAccount: true,
    });
    const { container } = render(<BalanceList />);
    // SkeletonRow renders divs with animate-pulse
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows empty state when balances is empty", () => {
    vi.mocked(useSorokit).mockReturnValue({ ...base, isConnected: true });
    render(<BalanceList />);
    expect(screen.getByText(/no assets found/i)).toBeInTheDocument();
  });

  it("renders a row for each balance", () => {
    vi.mocked(useSorokit).mockReturnValue({
      ...base,
      isConnected: true,
      balances: [
        { asset: "native", assetType: "native", balance: "100.0000000" },
        {
          asset: "USDC:GABC",
          assetType: "credit_alphanum4",
          assetCode: "USDC",
          assetIssuer: "GABCDEFGHIJKLMNOP",
          balance: "50.0000000",
        },
      ],
    });
    render(<BalanceList />);
    expect(screen.getByText("XLM")).toBeInTheDocument();
    expect(screen.getByText("USDC")).toBeInTheDocument();
  });
});
