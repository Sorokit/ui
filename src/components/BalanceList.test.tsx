import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";

import { balanceKey, BalanceList } from "./BalanceList";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

vi.mock("@/components/AssetBadge", () => ({
  AssetBadge: ({
    balance,
    showIssuerSuffix,
  }: {
    balance: { asset: string; assetIssuer?: string };
    showIssuerSuffix?: boolean;
  }) => (
    <span data-testid="asset-badge">
      {balance.asset}
      {showIssuerSuffix && balance.assetIssuer
        ? ` (${balance.assetIssuer.slice(0, 4)}...${balance.assetIssuer.slice(-4)})`
        : ""}
    </span>
  ),
}));

vi.mock("@/components/ui/Skeleton", () => ({
  AssetRowSkeleton: () => <div data-testid="skeleton-row" />,
}));

vi.mock("@/components/ui/Badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

const mockXlmBalance = { asset: "XLM", balance: "100.0000000", assetType: "native" as const };
const mockAbcBalance = {
  asset: "ABC",
  balance: "25.0000000",
  assetType: "credit_alphanum4" as const,
  assetCode: "ABC",
  assetIssuer: "GABCDEFGHJKLMNPQRSTUVWXYZ1234567890ABCDEFGH",
};
const mockUsdtZeroBalance = {
  asset: "USDT",
  balance: "0.0000000",
  assetType: "credit_alphanum4" as const,
  assetCode: "USDT",
  assetIssuer: "GB6USDTISSUERABCDEFGHIJKLMNOPQRSTUVWXYZ12345",
};
const mockUsdcBalance = {
  asset: "USDC",
  balance: "50.0000000",
  assetType: "credit_alphanum4" as const,
  assetCode: "USDC",
  assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
};
const mockLpBalance = {
  asset: "LP-POOL-1",
  balance: "10.0000000",
  assetType: "liquidity_pool_shares" as const,
};
const mockLpBalance2 = {
  asset: "LP-POOL-2",
  balance: "5.0000000",
  assetType: "liquidity_pool_shares" as const,
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
    expect(badges[0]).toHaveTextContent(/XLM|USDC/);
    expect(badges[1]).toHaveTextContent(/XLM|USDC/);
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

  it("sorts balances with XLM first, non-zero before zero, and alphabetical order within groups", () => {
    vi.mocked(useSorokit).mockReturnValue({
      balances: [mockUsdtZeroBalance, mockAbcBalance, mockXlmBalance, mockUsdcBalance],
      isLoadingAccount: false,
      isConnected: true,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<BalanceList />);
    const badges = screen.getAllByTestId("asset-badge");
    expect(badges).toHaveLength(4);
    expect(badges[0]).toHaveTextContent("XLM");
    expect(badges[1]).toHaveTextContent("ABC");
    expect(badges[2]).toHaveTextContent("USDC");
    expect(badges[3]).toHaveTextContent("USDT");
  });

  it("renders zero-balance rows with opacity and no-balance label, but not for non-zero assets", () => {
    vi.mocked(useSorokit).mockReturnValue({
      balances: [mockAbcBalance, mockUsdtZeroBalance],
      isLoadingAccount: false,
      isConnected: true,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<BalanceList />);

    const noBalanceLabel = screen.getByText(/no balance/i);
    expect(noBalanceLabel).toBeInTheDocument();

    const zeroBalanceRow = noBalanceLabel.closest(".border-b");
    expect(zeroBalanceRow).toHaveClass("opacity-50");

    const nonZeroRow = screen.getByText("ABC").closest(".border-b");
    expect(nonZeroRow).not.toHaveClass("opacity-50");
    expect(screen.queryAllByText(/no balance/i)).toHaveLength(1);
  });

  // ── Friendbot link conditional rendering tests (#81) ────────────────────────
  describe("Friendbot link", () => {
    it("renders Friendbot link on testnet with empty balances", () => {
      vi.mocked(useSorokit).mockReturnValue({
        balances: [],
        isLoadingAccount: false,
        isConnected: true,
        network: { name: "testnet" as const, passphrase: "Test SDF Network", rpcUrl: "https://testnet.rpc.com", horizonUrl: "https://testnet.horizon.com" },
      } as unknown as ReturnType<typeof useSorokit>);

      render(<BalanceList />);
      expect(screen.getByText(/no assets found/i)).toBeInTheDocument();
      expect(screen.getByText(/fund with friendbot/i)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /fund with friendbot/i })).toHaveAttribute("href", "https://friendbot.stellar.org");
    });

    it("does not render Friendbot link on mainnet with empty balances", () => {
      vi.mocked(useSorokit).mockReturnValue({
        balances: [],
        isLoadingAccount: false,
        isConnected: true,
        network: { name: "mainnet" as const, passphrase: "Public Global Stellar Network", rpcUrl: "https://mainnet.rpc.com", horizonUrl: "https://mainnet.horizon.com" },
      } as unknown as ReturnType<typeof useSorokit>);

      render(<BalanceList />);
      expect(screen.getByText(/no assets found/i)).toBeInTheDocument();
      expect(screen.queryByText(/fund with friendbot/i)).not.toBeInTheDocument();
    });

    it("does not render Friendbot link on testnet with non-empty balances", () => {
      vi.mocked(useSorokit).mockReturnValue({
        balances: [mockXlmBalance],
        isLoadingAccount: false,
        isConnected: true,
        network: { name: "testnet" as const, passphrase: "Test SDF Network", rpcUrl: "https://testnet.rpc.com", horizonUrl: "https://testnet.horizon.com" },
      } as unknown as ReturnType<typeof useSorokit>);

      render(<BalanceList />);
      expect(screen.queryByText(/no assets found/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/fund with friendbot/i)).not.toBeInTheDocument();
    });

    it("does not render Friendbot link when not connected", () => {
      vi.mocked(useSorokit).mockReturnValue({
        balances: [],
        isLoadingAccount: false,
        isConnected: false,
        network: { name: "testnet" as const, passphrase: "Test SDF Network", rpcUrl: "https://testnet.rpc.com", horizonUrl: "https://testnet.horizon.com" },
      } as unknown as ReturnType<typeof useSorokit>);

      render(<BalanceList />);
      expect(screen.getByText(/connect your wallet/i)).toBeInTheDocument();
      expect(screen.queryByText(/fund with friendbot/i)).not.toBeInTheDocument();
    });

    it("shows a skeleton row count that matches the last known balance count on refresh (#205)", () => {
      // Initial load: no balances loaded yet -> falls back to 3 skeletons.
      const { rerender } = render(<BalanceList />);
      vi.mocked(useSorokit).mockReturnValue({
        balances: [],
        isLoadingAccount: true,
        isConnected: true,
      } as unknown as ReturnType<typeof useSorokit>);
      rerender(<BalanceList />);
      expect(screen.getAllByTestId("skeleton-row")).toHaveLength(3);

      // Balances load: 7 assets.
      const sevenBalances = Array.from({ length: 7 }, (_, i) => ({
        asset: `ASSET${i}`,
        balance: "1.0000000",
        assetType: "credit_alphanum4" as const,
        assetCode: `A${i}`,
        assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      }));
      vi.mocked(useSorokit).mockReturnValue({
        balances: sevenBalances,
        isLoadingAccount: false,
        isConnected: true,
      } as unknown as ReturnType<typeof useSorokit>);
      rerender(<BalanceList />);
      expect(screen.getAllByTestId("asset-badge")).toHaveLength(7);

      // Refresh: loading again, but the last known 7 balances are still in
      // context (not cleared to []) — skeleton count should match 7, not 3.
      vi.mocked(useSorokit).mockReturnValue({
        balances: sevenBalances,
        isLoadingAccount: true,
        isConnected: true,
      } as unknown as ReturnType<typeof useSorokit>);
      rerender(<BalanceList />);
      expect(screen.getAllByTestId("skeleton-row")).toHaveLength(7);
    });

    it("does not render Friendbot link when loading account", () => {
      vi.mocked(useSorokit).mockReturnValue({
        balances: [],
        isLoadingAccount: true,
        isConnected: true,
        network: { name: "testnet" as const, passphrase: "Test SDF Network", rpcUrl: "https://testnet.rpc.com", horizonUrl: "https://testnet.horizon.com" },
      } as unknown as ReturnType<typeof useSorokit>);

      render(<BalanceList />);
      expect(screen.getAllByTestId("skeleton-row")).toHaveLength(3);
      expect(screen.queryByText(/fund with friendbot/i)).not.toBeInTheDocument();
    });
  });

  describe("search filter (#352)", () => {
    beforeEach(() => {
      vi.mocked(useSorokit).mockReturnValue({
        balances: [mockXlmBalance, mockAbcBalance, mockUsdcBalance, mockUsdtZeroBalance],
        isLoadingAccount: false,
        isConnected: true,
      } as unknown as ReturnType<typeof useSorokit>);
    });

    it("filters asset rows by code as the user types", () => {
      render(<BalanceList />);
      const search = screen.getByPlaceholderText("Search assets…");

      fireEvent.change(search, { target: { value: "usd" } });

      const badges = screen.getAllByTestId("asset-badge");
      expect(badges.map((b) => b.textContent)).toEqual(["USDC", "USDT"]);
    });

    it("filters case-insensitively", () => {
      render(<BalanceList />);
      const search = screen.getByPlaceholderText("Search assets…");

      fireEvent.change(search, { target: { value: "ABC" } });

      const badges = screen.getAllByTestId("asset-badge");
      expect(badges).toHaveLength(1);
      expect(badges[0]).toHaveTextContent("ABC");
    });

    it("shows 'No matching assets' when the search matches nothing", () => {
      render(<BalanceList />);
      const search = screen.getByPlaceholderText("Search assets…");

      fireEvent.change(search, { target: { value: "zzz-nonexistent" } });

      expect(screen.getByText("No matching assets")).toBeInTheDocument();
      expect(screen.queryAllByTestId("asset-badge")).toHaveLength(0);
    });

    it("restores the full list when the search is cleared", () => {
      render(<BalanceList />);
      const search = screen.getByPlaceholderText("Search assets…");

      fireEvent.change(search, { target: { value: "ABC" } });
      expect(screen.getAllByTestId("asset-badge")).toHaveLength(1);

      fireEvent.change(search, { target: { value: "" } });
      expect(screen.getAllByTestId("asset-badge")).toHaveLength(4);
    });
  });

  describe("portfolio total (#314)", () => {
    it("does not render a total when showTotal is not passed", () => {
      vi.mocked(useSorokit).mockReturnValue({
        balances: [mockXlmBalance],
        isLoadingAccount: false,
        isConnected: true,
      } as unknown as ReturnType<typeof useSorokit>);

      render(<BalanceList />);
      expect(screen.queryByText(/^~/)).not.toBeInTheDocument();
    });

    it("renders the summed native XLM total when showTotal is true", () => {
      vi.mocked(useSorokit).mockReturnValue({
        balances: [mockXlmBalance, mockUsdcBalance],
        isLoadingAccount: false,
        isConnected: true,
      } as unknown as ReturnType<typeof useSorokit>);

      render(<BalanceList showTotal />);
      expect(screen.getByText("~100 XLM")).toBeInTheDocument();
    });

    it("renders a USD-equivalent figure when xlmPrice is also provided", () => {
      vi.mocked(useSorokit).mockReturnValue({
        balances: [mockXlmBalance],
        isLoadingAccount: false,
        isConnected: true,
      } as unknown as ReturnType<typeof useSorokit>);

      render(<BalanceList showTotal xlmPrice={0.5} />);
      expect(screen.getByText("~100 XLM (~$50)")).toBeInTheDocument();
    });
  });

  describe("Liquidity Positions section (#314)", () => {
    const mockLpBalance = {
      asset: "LP:XLM/USDC",
      balance: "10.0000000",
      assetType: "liquidity_pool_shares" as const,
    };

    it("renders LP share balances in a separate 'Liquidity Positions' section", () => {
      vi.mocked(useSorokit).mockReturnValue({
        balances: [mockXlmBalance, mockLpBalance],
        isLoadingAccount: false,
        isConnected: true,
      } as unknown as ReturnType<typeof useSorokit>);

      render(<BalanceList />);
      expect(screen.getByText("Liquidity Positions")).toBeInTheDocument();
      const badges = screen.getAllByTestId("asset-badge");
      expect(badges.map((b) => b.textContent)).toEqual(["XLM", "LP:XLM/USDC"]);
    });

    it("does not render the Liquidity Positions header when there are no LP balances", () => {
      vi.mocked(useSorokit).mockReturnValue({
        balances: [mockXlmBalance],
        isLoadingAccount: false,
        isConnected: true,
      } as unknown as ReturnType<typeof useSorokit>);

      render(<BalanceList />);
      expect(screen.queryByText("Liquidity Positions")).not.toBeInTheDocument();
    });
  });

  describe("sort toggle (#352)", () => {
    beforeEach(() => {
      vi.mocked(useSorokit).mockReturnValue({
        balances: [mockUsdtZeroBalance, mockAbcBalance, mockXlmBalance, mockUsdcBalance],
        isLoadingAccount: false,
        isConnected: true,
      } as unknown as ReturnType<typeof useSorokit>);
    });

    function badgeOrder() {
      return screen.getAllByTestId("asset-badge").map((b) => b.textContent);
    }

    it("starts in Default mode: XLM first, non-zero before zero, alphabetical within groups", () => {
      render(<BalanceList />);
      expect(screen.getByTitle("Sort: Default")).toBeInTheDocument();
      expect(badgeOrder()).toEqual(["XLM", "ABC", "USDC", "USDT"]);
    });

    it("cycles to Balance (desc) mode on the first click", () => {
      render(<BalanceList />);
      fireEvent.click(screen.getByTitle("Sort: Default"));

      expect(screen.getByTitle("Sort: Balance")).toBeInTheDocument();
      // XLM=100, USDC=50, ABC=25, USDT=0 — highest balance first.
      expect(badgeOrder()).toEqual(["XLM", "USDC", "ABC", "USDT"]);
    });

    it("cycles to A-Z (alpha) mode on the second click", () => {
      render(<BalanceList />);
      fireEvent.click(screen.getByTitle("Sort: Default"));
      fireEvent.click(screen.getByTitle("Sort: Balance"));

      expect(screen.getByTitle("Sort: A-Z")).toBeInTheDocument();
      expect(badgeOrder()).toEqual(["ABC", "USDC", "USDT", "XLM"]);
    });

    it("cycles back to Default mode on the third click", () => {
      render(<BalanceList />);
      fireEvent.click(screen.getByTitle("Sort: Default"));
      fireEvent.click(screen.getByTitle("Sort: Balance"));
      fireEvent.click(screen.getByTitle("Sort: A-Z"));

      expect(screen.getByTitle("Sort: Default")).toBeInTheDocument();
      expect(badgeOrder()).toEqual(["XLM", "ABC", "USDC", "USDT"]);
    });

    it("applies the active sort mode on top of the search filter", () => {
      render(<BalanceList />);
      const search = screen.getByPlaceholderText("Search assets…");
      fireEvent.change(search, { target: { value: "us" } });
      fireEvent.click(screen.getByTitle("Sort: Default")); // -> balance-desc

      // USDC=50, USDT=0 — highest balance first, filtered to only the two "us*" assets.
      expect(badgeOrder()).toEqual(["USDC", "USDT"]);
    });
  });

  // ── LP shares grouping (#328) ───────────────────────────────────────────────
  describe("liquidity pool shares grouping", () => {
    it("does not render a 'Liquidity Pool Shares' heading when there are no LP balances", () => {
      vi.mocked(useSorokit).mockReturnValue({
        balances: [mockXlmBalance, mockAbcBalance],
        isLoadingAccount: false,
        isConnected: true,
      } as unknown as ReturnType<typeof useSorokit>);

      render(<BalanceList />);
      expect(
        screen.queryByText(/liquidity positions|liquidity pool shares/i),
      ).not.toBeInTheDocument();
    });

    it("renders a 'Liquidity Pool Shares' heading and section when an LP balance is present", () => {
      vi.mocked(useSorokit).mockReturnValue({
        balances: [mockXlmBalance, mockAbcBalance, mockLpBalance],
        isLoadingAccount: false,
        isConnected: true,
      } as unknown as ReturnType<typeof useSorokit>);

      render(<BalanceList />);
      expect(screen.getByText(/liquidity positions|liquidity pool shares/i)).toBeInTheDocument();

      const badges = screen.getAllByTestId("asset-badge");
      expect(badges).toHaveLength(3);
      expect(badges.map((b) => b.textContent)).toContain("LP-POOL-1");
    });

    it("renders LP shares after the regular assets, in their own section", () => {
      vi.mocked(useSorokit).mockReturnValue({
        balances: [mockLpBalance, mockXlmBalance, mockAbcBalance],
        isLoadingAccount: false,
        isConnected: true,
      } as unknown as ReturnType<typeof useSorokit>);

      render(<BalanceList />);
      const badges = screen.getAllByTestId("asset-badge");
      // Regular assets (sorted XLM, ABC) still come first; LP shares follow.
      expect(badges.map((b) => b.textContent)).toEqual([
        "XLM",
        "ABC",
        "LP-POOL-1",
      ]);
    });

    it("supports multiple LP balances within the LP section", () => {
      vi.mocked(useSorokit).mockReturnValue({
        balances: [mockXlmBalance, mockLpBalance2, mockLpBalance],
        isLoadingAccount: false,
        isConnected: true,
      } as unknown as ReturnType<typeof useSorokit>);

      render(<BalanceList />);
      const badges = screen.getAllByTestId("asset-badge");
      // Within the LP section, the default sort is still alphabetical by code.
      expect(badges.map((b) => b.textContent)).toEqual([
        "XLM",
        "LP-POOL-1",
        "LP-POOL-2",
      ]);
    });

    it("still applies search filtering within the LP section", () => {
      vi.mocked(useSorokit).mockReturnValue({
        balances: [mockXlmBalance, mockAbcBalance, mockLpBalance],
        isLoadingAccount: false,
        isConnected: true,
      } as unknown as ReturnType<typeof useSorokit>);

      render(<BalanceList />);
      const search = screen.getByPlaceholderText("Search assets…");
      fireEvent.change(search, { target: { value: "lp-pool-1" } });

      expect(screen.getByText(/liquidity positions|liquidity pool shares/i)).toBeInTheDocument();
      const badges = screen.getAllByTestId("asset-badge");
      expect(badges).toHaveLength(1);
      expect(badges[0]).toHaveTextContent("LP-POOL-1");
    });

    it("hides the LP section when a search filters out all LP balances", () => {
      vi.mocked(useSorokit).mockReturnValue({
        balances: [mockXlmBalance, mockAbcBalance, mockLpBalance],
        isLoadingAccount: false,
        isConnected: true,
      } as unknown as ReturnType<typeof useSorokit>);

      render(<BalanceList />);
      const search = screen.getByPlaceholderText("Search assets…");
      fireEvent.change(search, { target: { value: "abc" } });

      expect(
        screen.queryByText(/liquidity positions|liquidity pool shares/i),
      ).not.toBeInTheDocument();
    });

    it("renders the LP row as an interactive button when onAssetClick is passed", () => {
      const onAssetClick = vi.fn();
      vi.mocked(useSorokit).mockReturnValue({
        balances: [mockXlmBalance, mockLpBalance],
        isLoadingAccount: false,
        isConnected: true,
      } as unknown as ReturnType<typeof useSorokit>);

      render(<BalanceList onAssetClick={onAssetClick} />);
      const lpBadge = screen.getByText("LP-POOL-1");
      const lpRow = lpBadge.closest('[role="button"]');
      expect(lpRow).not.toBeNull();

      fireEvent.click(lpRow as HTMLElement);
      expect(onAssetClick).toHaveBeenCalledWith(mockLpBalance);
    });
  });

  // ── onAssetClick interactivity (#328) ───────────────────────────────────────
  describe("onAssetClick interactivity", () => {
    beforeEach(() => {
      vi.mocked(useSorokit).mockReturnValue({
        balances: [mockXlmBalance, mockAbcBalance],
        isLoadingAccount: false,
        isConnected: true,
      } as unknown as ReturnType<typeof useSorokit>);
    });

    it("renders asset rows with role='button' when onAssetClick is passed", () => {
      const onAssetClick = vi.fn();
      render(<BalanceList onAssetClick={onAssetClick} />);

      // Both asset rows (XLM, ABC) should be exposed as buttons, in addition
      // to the unrelated sort-toggle <button> element already in the header.
      const xlmRow = screen.getByText("XLM").closest(".border-b");
      const abcRow = screen.getByText("ABC").closest(".border-b");
      expect(xlmRow).toHaveAttribute("role", "button");
      expect(xlmRow).toHaveAttribute("tabIndex", "0");
      expect(abcRow).toHaveAttribute("role", "button");
      expect(abcRow).toHaveAttribute("tabIndex", "0");
    });

    it("calls onAssetClick with the correct balance when a row is clicked", () => {
      const onAssetClick = vi.fn();
      render(<BalanceList onAssetClick={onAssetClick} />);

      const abcRow = screen.getByText("ABC").closest(".border-b") as HTMLElement;
      fireEvent.click(abcRow);

      expect(onAssetClick).toHaveBeenCalledTimes(1);
      expect(onAssetClick).toHaveBeenCalledWith(mockAbcBalance);
    });

    it("calls onAssetClick when a row is activated via the Enter key", () => {
      const onAssetClick = vi.fn();
      render(<BalanceList onAssetClick={onAssetClick} />);

      const xlmRow = screen.getByText("XLM").closest(".border-b") as HTMLElement;
      fireEvent.keyDown(xlmRow, { key: "Enter" });

      expect(onAssetClick).toHaveBeenCalledWith(mockXlmBalance);
    });

    it("calls onAssetClick when a row is activated via the Space key", () => {
      const onAssetClick = vi.fn();
      render(<BalanceList onAssetClick={onAssetClick} />);

      const xlmRow = screen.getByText("XLM").closest(".border-b") as HTMLElement;
      fireEvent.keyDown(xlmRow, { key: " " });

      expect(onAssetClick).toHaveBeenCalledWith(mockXlmBalance);
    });

    it("does not render rows as buttons when onAssetClick is omitted", () => {
      render(<BalanceList />);

      expect(screen.queryByRole("button", { name: "" })).not.toBeInTheDocument();
      const xlmRow = screen.getByText("XLM").closest(".border-b");
      expect(xlmRow).not.toHaveAttribute("role", "button");
      expect(xlmRow).not.toHaveAttribute("tabIndex");
    });
  });

  // ── showTotal + xlmPrice (#328) ──────────────────────────────────────────────
  describe("showTotal / xlmPrice portfolio total", () => {
    it("renders a formatted portfolio total when showTotal and xlmPrice are set", () => {
      vi.mocked(useSorokit).mockReturnValue({
        balances: [mockXlmBalance, mockAbcBalance],
        isLoadingAccount: false,
        isConnected: true,
      } as unknown as ReturnType<typeof useSorokit>);

      render(<BalanceList showTotal xlmPrice={0.5} />);

      // mockXlmBalance.balance = "100.0000000" -> 100 * 0.5 = 50
      expect(
        screen.getByText((content, element) => {
          const hasText = /~100 XLM/i.test(element?.textContent ?? "") && /~\$50/i.test(element?.textContent ?? "");
          return hasText && element?.tagName.toLowerCase() === "p";
        }),
      ).toBeInTheDocument();
    });

    it("does not render a portfolio total when showTotal is omitted", () => {
      vi.mocked(useSorokit).mockReturnValue({
        balances: [mockXlmBalance],
        isLoadingAccount: false,
        isConnected: true,
      } as unknown as ReturnType<typeof useSorokit>);

      render(<BalanceList xlmPrice={0.5} />);
      expect(
        screen.queryByText((content, element) => {
          const text = element?.textContent ?? "";
          return /XLM.*~\$/i.test(text) && element?.tagName.toLowerCase() === "p";
        }),
      ).not.toBeInTheDocument();
    });

    it("does not render a portfolio total when xlmPrice is omitted", () => {
      vi.mocked(useSorokit).mockReturnValue({
        balances: [mockXlmBalance],
        isLoadingAccount: false,
        isConnected: true,
      } as unknown as ReturnType<typeof useSorokit>);

      render(<BalanceList showTotal />);
      expect(
        screen.queryByText((content, element) => {
          const text = element?.textContent ?? "";
          return /~\$/i.test(text) && element?.tagName.toLowerCase() === "p";
        }),
      ).not.toBeInTheDocument();
    });

    it("does not render a portfolio total when not connected", () => {
      vi.mocked(useSorokit).mockReturnValue({
        balances: [],
        isLoadingAccount: false,
        isConnected: false,
      } as unknown as ReturnType<typeof useSorokit>);

      render(<BalanceList showTotal xlmPrice={0.5} />);
      expect(
        screen.queryByText((content, element) => {
          const text = element?.textContent ?? "";
          return /~\$/i.test(text) && element?.tagName.toLowerCase() === "p";
        }),
      ).not.toBeInTheDocument();
    });

    it("does not render a portfolio total while loading", () => {
      vi.mocked(useSorokit).mockReturnValue({
        balances: [mockXlmBalance],
        isLoadingAccount: true,
        isConnected: true,
      } as unknown as ReturnType<typeof useSorokit>);

      render(<BalanceList showTotal xlmPrice={0.5} />);
      expect(
        screen.queryByText((content, element) => {
          const text = element?.textContent ?? "";
          return /~\$/i.test(text) && element?.tagName.toLowerCase() === "p";
        }),
      ).not.toBeInTheDocument();
    });

    it("falls back to a total of 0 when there is no native XLM balance", () => {
      vi.mocked(useSorokit).mockReturnValue({
        balances: [mockAbcBalance],
        isLoadingAccount: false,
        isConnected: true,
      } as unknown as ReturnType<typeof useSorokit>);

      render(<BalanceList showTotal xlmPrice={0.5} />);
      expect(
        screen.getByText((content, element) => {
          const hasText = /~0 XLM/i.test(element?.textContent ?? "") && /~\$0/i.test(element?.textContent ?? "");
          return hasText && element?.tagName.toLowerCase() === "p";
        }),
      ).toBeInTheDocument();
    });
  });

  describe("balanceKey (issue #524)", () => {
    it("produces different keys for the same asset code with different issuers", () => {
      const usdcIssuerA = { ...mockUsdcBalance, assetIssuer: "GISSUERAAAA1111111111111111111111111111111" };
      const usdcIssuerB = { ...mockUsdcBalance, assetIssuer: "GISSUERBBBB2222222222222222222222222222222" };
      expect(balanceKey(usdcIssuerA)).not.toBe(balanceKey(usdcIssuerB));
    });

    it("produces the same key for identical asset+issuer combinations", () => {
      expect(balanceKey(mockUsdcBalance)).toBe(balanceKey({ ...mockUsdcBalance }));
    });

    it("falls back to 'native' for a balance with no assetIssuer (XLM)", () => {
      expect(balanceKey(mockXlmBalance)).toBe("XLM-native");
    });

    it("produces a unique key per liquidity pool even though assetIssuer is undefined for both", () => {
      expect(balanceKey(mockLpBalance)).not.toBe(balanceKey(mockLpBalance2));
    });
  });

  describe("duplicate asset code from different issuers (issue #524 & #601)", () => {
    it("renders both rows without a React key collision when two balances share an asset code but differ by issuer", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const usdcIssuerA = {
        asset: "USDC",
        balance: "10.0000000",
        assetType: "credit_alphanum4" as const,
        assetCode: "USDC",
        assetIssuer: "GISSUERAAAA1111111111111111111111111111111",
      };
      const usdcIssuerB = {
        asset: "USDC",
        balance: "20.0000000",
        assetType: "credit_alphanum4" as const,
        assetCode: "USDC",
        assetIssuer: "GISSUERBBBB2222222222222222222222222222222",
      };

      vi.mocked(useSorokit).mockReturnValue({
        balances: [usdcIssuerA, usdcIssuerB],
        isLoadingAccount: false,
        isConnected: true,
      } as unknown as ReturnType<typeof useSorokit>);

      render(<BalanceList />);

      const badges = screen.getAllByTestId("asset-badge");
      expect(badges).toHaveLength(2);
      expect(badges[0]).toHaveTextContent("USDC");
      expect(badges[1]).toHaveTextContent("USDC");

      const duplicateWarnings = consoleSpy.mock.calls.filter(([msg]) =>
        typeof msg === "string" && msg.includes("same key")
      );

      expect(duplicateWarnings).toHaveLength(0);
      consoleSpy.mockRestore();
    });
  });
});
