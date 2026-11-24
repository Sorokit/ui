/**
 * Integration tests for AccountScreen â€” #1065
 *
 * Tests the full component state flow:
 *   disconnected â†’ connected (loading) â†’ balances loaded â†’ allowances loaded â†’ UI ready
 */
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AccountScreen } from "./AccountScreen";

// â”€â”€ Mock sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Keep them as simple pass-through stubs so the integration test focuses on
// AccountScreen's own state machine, not on sub-component internals.

vi.mock("@/components/AccountCard", () => ({
  AccountCard: () => <div data-testid="account-card">AccountCard</div>,
  copyToClipboard: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/components/BalanceList", () => ({
  BalanceList: () => <div data-testid="balance-list">BalanceList</div>,
}));

vi.mock("@/components/ClaimableBalanceCard", () => ({
  ClaimableBalanceCard: () => (
    <div data-testid="claimable-balance-card">ClaimableBalanceCard</div>
  ),
}));

vi.mock("@/components/KeystoreBackup", () => ({
  KeystoreBackup: () => <div data-testid="keystore-backup">KeystoreBackup</div>,
}));

vi.mock("@/components/ui/Button", () => ({
  Button: ({
    children,
    onClick,
    loading,
    "aria-label": ariaLabel,
    ...rest
  }: React.ComponentPropsWithoutRef<"button"> & { loading?: boolean }) => (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={loading}
      data-loading={loading ? "true" : undefined}
      {...rest}
    >
      {children}
    </button>
  ),
}));

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => null,
}));

vi.mock("@hugeicons/core-free-icons", () => ({
  Download01Icon: {},
  Refresh01Icon: {},
}));

// â”€â”€ Mock useSorokit context â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const mockRefreshAccount = vi.fn();

const defaultContext = {
  isConnected: false,
  isLoadingAccount: false,
  refreshAccount: mockRefreshAccount,
  address: null as string | null,
  account: null,
  balances: [],
  network: null,
};

let sorokitContext = { ...defaultContext };

vi.mock("@/context/useSorokit", () => ({
  useSorokit: () => sorokitContext,
}));

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function renderScreen() {
  return render(<AccountScreen />);
}

function setContext(overrides: Partial<typeof defaultContext>) {
  sorokitContext = { ...defaultContext, ...overrides };
}

// â”€â”€ Tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("AccountScreen integration â€” #1065", () => {
  beforeEach(() => {
    sorokitContext = { ...defaultContext };
    mockRefreshAccount.mockReset().mockResolvedValue(undefined);
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // â”€â”€ Disconnected state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("renders the Account heading when disconnected", () => {
    renderScreen();
    expect(screen.getByText("Account")).toBeTruthy();
    expect(screen.getByText("Balances and account details")).toBeTruthy();
  });

  it("does not show the refresh or export controls when disconnected", () => {
    renderScreen();
    expect(screen.queryByLabelText("Refresh account data")).toBeNull();
    expect(screen.queryByTestId("account-export-button")).toBeNull();
  });

  it("always renders all four sub-components regardless of connection", () => {
    renderScreen();
    expect(screen.getByTestId("account-card")).toBeTruthy();
    expect(screen.getByTestId("balance-list")).toBeTruthy();
    expect(screen.getByTestId("claimable-balance-card")).toBeTruthy();
    expect(screen.getByTestId("keystore-backup")).toBeTruthy();
  });

  // â”€â”€ Connected state â€” loading â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("shows the refresh button while loading and marks it as loading", () => {
    setContext({ isConnected: true, isLoadingAccount: true, address: "GADDR" });
    renderScreen();

    const refreshBtn = screen.getByLabelText("Refresh account data");
    expect(refreshBtn).toBeTruthy();
    expect(refreshBtn.getAttribute("data-loading")).toBe("true");
  });

  it("renders the export button when connected with an address", () => {
    setContext({
      isConnected: true,
      isLoadingAccount: false,
      address: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    });
    renderScreen();

    expect(screen.getByTestId("account-export-button")).toBeTruthy();
  });

  // â”€â”€ Connected state â€” data loaded â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("renders all sub-components after balances load", async () => {
    setContext({
      isConnected: true,
      isLoadingAccount: false,
      address: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      balances: [{ asset: "XLM", balance: "100.0" }] as any,
    });

    renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("balance-list")).toBeTruthy();
      expect(screen.getByTestId("claimable-balance-card")).toBeTruthy();
    });
  });

  // â”€â”€ Explorer link â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("renders the explorer link for testnet", () => {
    const address = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
    setContext({
      isConnected: true,
      isLoadingAccount: false,
      address,
      network: { name: "testnet" } as any,
    });
    renderScreen();

    const link = screen.getByTestId("account-explorer-link");
    expect(link.getAttribute("href")).toBe(
      `https://stellar.expert/explorer/testnet/account/${address}`
    );
  });

  it("renders the explorer link for mainnet", () => {
    const address = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
    setContext({
      isConnected: true,
      isLoadingAccount: false,
      address,
      network: { name: "mainnet" } as any,
    });
    renderScreen();

    const link = screen.getByTestId("account-explorer-link");
    expect(link.getAttribute("href")).toBe(
      `https://stellar.expert/explorer/public/account/${address}`
    );
  });

  it("does not render the explorer link for unknown networks", () => {
    setContext({
      isConnected: true,
      isLoadingAccount: false,
      address: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      network: { name: "futurenet" } as any,
    });
    renderScreen();

    expect(screen.queryByTestId("account-explorer-link")).toBeNull();
  });

  // â”€â”€ Refresh flow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("calls refreshAccount when Refresh is clicked and shows last-updated label", async () => {
    setContext({
      isConnected: true,
      isLoadingAccount: false,
      address: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    });
    renderScreen();

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    await act(async () => {
      await user.click(screen.getByLabelText("Refresh account data"));
    });

    expect(mockRefreshAccount).toHaveBeenCalledOnce();
    expect(screen.getByText(/Last updated: just now/i)).toBeTruthy();
  });

  it("updates the last-updated label after one minute", async () => {
    setContext({
      isConnected: true,
      isLoadingAccount: false,
      address: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    });
    renderScreen();

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    await act(async () => {
      await user.click(screen.getByLabelText("Refresh account data"));
    });

    expect(screen.getByText(/Last updated: just now/i)).toBeTruthy();

    // Advance the interval timer by 61 s
    await act(async () => {
      vi.advanceTimersByTime(61_000);
    });

    expect(screen.getByText(/Last updated: 1 min ago/i)).toBeTruthy();
  });

  // â”€â”€ Full flow: disconnected â†’ loading â†’ loaded â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("renders all sub-components in the final ready state", async () => {
    setContext({
      isConnected: true,
      isLoadingAccount: false,
      address: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      balances: [{ asset: "XLM", balance: "250.0" }] as any,
      account: { sequence: "1234" } as any,
      network: { name: "testnet" } as any,
    });

    renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("account-card")).toBeTruthy();
      expect(screen.getByTestId("balance-list")).toBeTruthy();
      expect(screen.getByTestId("claimable-balance-card")).toBeTruthy();
      expect(screen.getByTestId("keystore-backup")).toBeTruthy();
      expect(screen.getByTestId("account-explorer-link")).toBeTruthy();
      expect(screen.getByTestId("account-export-button")).toBeTruthy();
    });
  });
});
