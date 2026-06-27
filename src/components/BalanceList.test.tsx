import { render, screen } from "@testing-library/react";
import { beforeEach,describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";

import { BalanceList } from "./BalanceList";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

vi.mock("@/components/AssetBadge", () => ({
  AssetBadge: ({ balance }: { balance: { asset: string } }) => (
    <span data-testid="asset-badge">{balance.asset}</span>
  ),
}));

vi.mock("@/components/ui/Skeleton", () => ({
  AssetRowSkeleton: () => <div data-testid="skeleton-row" />,
}));

vi.mock("@/components/ui/Badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

const mockXlmBalance = { asset: "XLM", balance: "100.0000000", assetType: "native" as const };
const mockUsdcBalance = {
  asset: "USDC",
  balance: "50.0000000",
  assetType: "credit_alphanum4" as const,
  assetCode: "USDC",
  assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
};

describe("BalanceList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 'Connect your wallet' prompt when not connected", () => {
    vi.mocked(useSorokit).mockReturnValue({
      balances: [],
      isLoadingAccount: false,
      isConnected: false,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<BalanceList />);
    expect(screen.getByText(/connect your wallet/i)).toBeInTheDocument();
    expect(screen.queryByTestId("skeleton-row")).not.toBeInTheDocument();
  });

  it("renders loading skeletons when connected and loading", () => {
    vi.mocked(useSorokit).mockReturnValue({
      balances: [],
      isLoadingAccount: true,
      isConnected: true,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<BalanceList />);
    expect(screen.getAllByTestId("skeleton-row")).toHaveLength(3);
    expect(screen.queryByText(/no assets/i)).not.toBeInTheDocument();
  });

  it("renders 'No assets found' when connected, not loading, and balances are empty", () => {
    vi.mocked(useSorokit).mockReturnValue({
      balances: [],
      isLoadingAccount: false,
      isConnected: true,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<BalanceList />);
    expect(screen.getByText(/no assets found/i)).toBeInTheDocument();
    expect(screen.queryByTestId("skeleton-row")).not.toBeInTheDocument();
  });

  it("renders asset rows when connected with balances", () => {
    vi.mocked(useSorokit).mockReturnValue({
      balances: [mockXlmBalance, mockUsdcBalance],
      isLoadingAccount: false,
      isConnected: true,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<BalanceList />);
    const badges = screen.getAllByTestId("asset-badge");
    expect(badges).toHaveLength(2);
    expect(badges[0]).toHaveTextContent("XLM");
    expect(badges[1]).toHaveTextContent("USDC");
    expect(screen.queryByText(/no assets found/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("skeleton-row")).not.toBeInTheDocument();
  });

  it("shows asset count badge when connected and loaded", () => {
    vi.mocked(useSorokit).mockReturnValue({
      balances: [mockXlmBalance, mockUsdcBalance],
      isLoadingAccount: false,
      isConnected: true,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<BalanceList />);
    expect(screen.getByText("2 assets")).toBeInTheDocument();
  });

  it("formats balance amounts to 2–4 decimal places", () => {
    vi.mocked(useSorokit).mockReturnValue({
      balances: [{ ...mockXlmBalance, balance: "1234.5678900" }],
      isLoadingAccount: false,
      isConnected: true,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<BalanceList />);
    expect(screen.getByText(/1[,.]?234/)).toBeInTheDocument();
  });
});
