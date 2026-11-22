import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SorokitProvider } from "@/context/SorokitProvider";
import { useSorokit } from "@/context/useSorokit";
import { I18nProvider } from "@/i18n";
import type { Balance, SorokitClient, Transaction } from "@/lib/client";
import { getClient } from "@/lib/client";
import { createMockClient, MOCK_ADDRESS } from "@/lib/mock-client";

import { AccountSidebar } from "./AccountSidebar";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));
vi.mock("@/lib/client", () => ({
  getClient: vi.fn(),
  initClient: vi.fn(),
}));

const ADDRESS = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA";

function makeBalance(overrides: Partial<Balance> = {}): Balance {
  return {
    asset: "native",
    balance: "125.5000000",
    assetType: "native",
    ...overrides,
  };
}

function makeTx(i: number): Transaction {
  return {
    hash: `hash${String(i).padStart(56, "0")}`,
    ledger: 1000 + i,
    successful: true,
    createdAt: new Date("2024-01-01").toISOString(),
    operationCount: 1,
    feePaid: "100",
  };
}

function mockGetHistory(txs: Transaction[]) {
  vi.mocked(getClient).mockReturnValue({
    transaction: {
      getHistory: vi.fn().mockResolvedValue({ data: txs, error: null, total: txs.length }),
    },
  } as unknown as SorokitClient);
}

/** Waits for the sidebar's recent-transactions fetch effect to settle. */
async function flushTxFetch() {
  await waitFor(() => {
    expect(vi.mocked(getClient)).toHaveBeenCalled();
  });
}

/** Balance options only; the settings language <select> also renders <option>s. */
function getBalanceOptions() {
  return within(screen.getByRole("listbox", { name: "Account balances" })).getAllByRole("option");
}

function mockUseSorokit(overrides: Partial<ReturnType<typeof useSorokit>> = {}) {
  return {
    get client() { return getClient(); },
    address: null,
    isConnected: false,
    isConnecting: false,
    connectWallet: vi.fn(),
    disconnectWallet: vi.fn(),
    account: null,
    balances: [],
    isLoadingAccount: false,
    refreshAccount: vi.fn(),
    network: null,
    switchNetwork: vi.fn(),
    error: null,
    clearError: vi.fn(),
    ...overrides,
  };
}

describe("AccountSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockGetHistory([]);
  });

  it("renders nothing when closed", () => {
    vi.mocked(useSorokit).mockReturnValue(mockUseSorokit());
    const { container } = render(<AccountSidebar open={false} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("prompts to connect when open with no address", () => {
    vi.mocked(useSorokit).mockReturnValue(mockUseSorokit());
    render(<AccountSidebar open={true} onClose={vi.fn()} />);
    expect(screen.getByText(/connect your wallet/i)).toBeInTheDocument();
  });

  it("shows the full address with a copy affordance", async () => {
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokit({ address: ADDRESS, isConnected: true }),
    );
    render(<AccountSidebar open={true} onClose={vi.fn()} />);
    await flushTxFetch();
    expect(screen.getByText(ADDRESS)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy address/i })).toBeInTheDocument();
  });

  it("lists all asset balances", async () => {
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokit({
        address: ADDRESS,
        isConnected: true,
        balances: [
          makeBalance({ asset: "native", assetType: "native", balance: "100" }),
          makeBalance({ asset: "USDC:ISSUER", assetType: "credit_alphanum4", assetCode: "USDC", balance: "50" }),
        ],
      }),
    );
    render(<AccountSidebar open={true} onClose={vi.fn()} />);
    await flushTxFetch();
    expect(screen.getByText("Assets (2)")).toBeInTheDocument();
    expect(screen.getAllByText("XLM")[0]).toBeInTheDocument();
    expect(screen.getAllByText("USDC")[0]).toBeInTheDocument();
  });

  it("fetches and displays up to 5 recent transactions", async () => {
    const txs = Array.from({ length: 5 }, (_, i) => makeTx(i));
    mockGetHistory(txs);
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokit({ address: ADDRESS, isConnected: true }),
    );
    render(<AccountSidebar open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(vi.mocked(getClient)().transaction.getHistory).toHaveBeenCalledWith(
        ADDRESS,
        1,
        5,
      );
    });
  });

  it("shows a settings section with network, refresh, and disconnect", async () => {
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokit({
        address: ADDRESS,
        isConnected: true,
        network: { name: "testnet", passphrase: "x", rpcUrl: "x", horizonUrl: "x" },
      }),
    );
    render(<AccountSidebar open={true} onClose={vi.fn()} />);
    await flushTxFetch();
    expect(screen.getByText("testnet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh balances" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeInTheDocument();
  });

  it("requires a second click to actually disconnect", async () => {
    const mockDisconnect = vi.fn();
    const mockClose = vi.fn();
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokit({
        address: ADDRESS,
        isConnected: true,
        disconnectWallet: mockDisconnect,
      }),
    );
    render(<AccountSidebar open={true} onClose={mockClose} />);
    await flushTxFetch();

    const disconnectBtn = screen.getByRole("button", { name: "Disconnect" });
    fireEvent.click(disconnectBtn);
    expect(mockDisconnect).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirm disconnect?" }));
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it("closes on disconnect and reopens without the previous account data", async () => {
    const { useSorokit: useActualSorokit } =
      await vi.importActual<typeof import("@/context/useSorokit")>("@/context/useSorokit");
    vi.mocked(useSorokit).mockImplementation(useActualSorokit);
    const client = createMockClient({
      balances: [makeBalance()],
      history: [makeTx(1)],
    });
    const transactionLabel = /^Transaction .* Fee: 100 stroops$/;
    const disconnect = vi.spyOn(client.wallet, "disconnect");

    function WalletHarness() {
      const [open, setOpen] = useState(false);
      const { address, account, balances, connectWallet } = useActualSorokit();

      return (
        <>
          <button onClick={() => void connectWallet()}>Connect wallet</button>
          <button onClick={() => setOpen(true)}>Open account</button>
          <output aria-label="Wallet data">
            {JSON.stringify({ address, account, balances })}
          </output>
          <AccountSidebar open={open} onClose={() => setOpen(false)} />
        </>
      );
    }

    try {
      render(
        <SorokitProvider client={client}>
          <WalletHarness />
        </SorokitProvider>,
      );

      fireEvent.click(screen.getByRole("button", { name: "Connect wallet" }));
      fireEvent.click(screen.getByRole("button", { name: "Open account" }));
      expect(await screen.findByText(MOCK_ADDRESS)).toBeInTheDocument();
      expect(await screen.findByRole("listbox", { name: "Account balances" })).toBeInTheDocument();
      expect(await screen.findByLabelText(transactionLabel)).toBeInTheDocument();
      const walletData = screen.getByLabelText("Wallet data");
      expect(JSON.parse(walletData.textContent ?? "{}")).toMatchObject({
        address: MOCK_ADDRESS,
        account: expect.any(Object),
        balances: [makeBalance()],
      });

      fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
      fireEvent.click(screen.getByRole("button", { name: "Confirm disconnect?" }));

      expect(disconnect).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("dialog", { name: "Account details" })).not.toBeInTheDocument();
      await waitFor(() => {
        expect(JSON.parse(walletData.textContent ?? "{}")).toEqual({
          address: null,
          account: null,
          balances: [],
        });
      });

      fireEvent.click(screen.getByRole("button", { name: "Open account" }));
      expect(screen.getByText(/connect your wallet/i)).toBeInTheDocument();
      expect(screen.queryByText(MOCK_ADDRESS)).not.toBeInTheDocument();
      expect(screen.queryByRole("listbox", { name: "Account balances" })).not.toBeInTheDocument();
      expect(screen.queryByLabelText(transactionLabel)).not.toBeInTheDocument();
    } finally {
      vi.mocked(useSorokit).mockReset();
    }
  });

  it("toggles and persists the collapsed state", async () => {
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokit({ address: ADDRESS, isConnected: true }),
    );
    render(<AccountSidebar open={true} onClose={vi.fn()} />);
    await flushTxFetch();

    expect(screen.getByText("Account")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Collapse account sidebar" }));
    expect(screen.queryByText("Account")).not.toBeInTheDocument();
    expect(localStorage.getItem("sorokit-account-sidebar-collapsed")).toBe("true");
  });

  it("restores the collapsed state from localStorage on mount", async () => {
    localStorage.setItem("sorokit-account-sidebar-collapsed", "true");
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokit({ address: ADDRESS, isConnected: true }),
    );
    render(<AccountSidebar open={true} onClose={vi.fn()} />);
    await flushTxFetch();
    expect(screen.queryByText("Account")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand account sidebar" })).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
    const mockClose = vi.fn();
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokit({ address: ADDRESS, isConnected: true }),
    );
    render(<AccountSidebar open={true} onClose={mockClose} />);
    await flushTxFetch();
    fireEvent.click(screen.getByRole("button", { name: "Close account sidebar" }));
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the backdrop is clicked", async () => {
    const mockClose = vi.fn();
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokit({ address: ADDRESS, isConnected: true }),
    );
    const { container } = render(<AccountSidebar open={true} onClose={mockClose} />);
    await flushTxFetch();
    const backdrop = container.querySelector('[aria-hidden="true"]');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop as Element);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", async () => {
    const mockClose = vi.fn();
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokit({ address: ADDRESS, isConnected: true }),
    );
    render(<AccountSidebar open={true} onClose={mockClose} />);
    await flushTxFetch();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  // ── Empty-state message (#890) ──────────────────────────────────────────
  describe("empty state", () => {
    it("shows a helpful 'No linked accounts' message when there are zero balances", async () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({ address: ADDRESS, isConnected: true, balances: [] }),
      );
      render(<AccountSidebar open={true} onClose={vi.fn()} />);
      await flushTxFetch();
      const message = screen.getByText(/no linked accounts/i);
      expect(message).toBeInTheDocument();
      expect(message).toHaveAttribute("role", "status");
    });

    it("does not show the empty-account message when balances are present", async () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          address: ADDRESS,
          isConnected: true,
          balances: [makeBalance()],
        }),
      );
      render(<AccountSidebar open={true} onClose={vi.fn()} />);
      await flushTxFetch();
      expect(screen.queryByText(/no linked accounts/i)).not.toBeInTheDocument();
    });

    it("renders every balance when multiple accounts/assets exist", async () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          address: ADDRESS,
          isConnected: true,
          balances: [
            makeBalance({ asset: "native", assetType: "native", balance: "10" }),
            makeBalance({ asset: "USDC:ISSUER", assetType: "credit_alphanum4", assetCode: "USDC", balance: "20" }),
            makeBalance({ asset: "AQUA:ISSUER", assetType: "credit_alphanum4", assetCode: "AQUA", balance: "30" }),
          ],
        }),
      );
      render(<AccountSidebar open={true} onClose={vi.fn()} />);
      await flushTxFetch();
      expect(screen.getByText("Assets (3)")).toBeInTheDocument();
      expect(getBalanceOptions()).toHaveLength(3);
    });
  });

  // ── Balance listbox keyboard navigation (#890) ──────────────────────────
  describe("balance listbox keyboard navigation", () => {
    function renderWithBalances() {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          address: ADDRESS,
          isConnected: true,
          balances: [
            makeBalance({ asset: "native", assetType: "native", balance: "10" }),
            makeBalance({ asset: "USDC:ISSUER", assetType: "credit_alphanum4", assetCode: "USDC", balance: "20" }),
            makeBalance({ asset: "AQUA:ISSUER", assetType: "credit_alphanum4", assetCode: "AQUA", balance: "30" }),
          ],
        }),
      );
      return render(<AccountSidebar open={true} onClose={vi.fn()} />);
    }

    it("exposes the balances as an ARIA listbox with the first item active by default", async () => {
      renderWithBalances();
      await flushTxFetch();
      const listbox = screen.getByRole("listbox", { name: "Account balances" });
      expect(listbox).toHaveAttribute("aria-activedescendant", "balance-item-0");
      const options = getBalanceOptions();
      expect(options[0]).toHaveAttribute("aria-selected", "true");
      expect(options[1]).toHaveAttribute("aria-selected", "false");
    });

    it("moves the active descendant forward on ArrowDown", async () => {
      renderWithBalances();
      await flushTxFetch();
      const listbox = screen.getByRole("listbox", { name: "Account balances" });
      fireEvent.keyDown(listbox, { key: "ArrowDown" });
      expect(listbox).toHaveAttribute("aria-activedescendant", "balance-item-1");
      expect(getBalanceOptions()[1]).toHaveAttribute("aria-selected", "true");
    });

    it("moves the active descendant backward on ArrowUp, wrapping to the last item", async () => {
      renderWithBalances();
      await flushTxFetch();
      const listbox = screen.getByRole("listbox", { name: "Account balances" });
      fireEvent.keyDown(listbox, { key: "ArrowUp" });
      expect(listbox).toHaveAttribute("aria-activedescendant", "balance-item-2");
    });

    it("wraps ArrowDown from the last item back to the first", async () => {
      renderWithBalances();
      await flushTxFetch();
      const listbox = screen.getByRole("listbox", { name: "Account balances" });
      fireEvent.keyDown(listbox, { key: "ArrowDown" });
      fireEvent.keyDown(listbox, { key: "ArrowDown" });
      fireEvent.keyDown(listbox, { key: "ArrowDown" });
      expect(listbox).toHaveAttribute("aria-activedescendant", "balance-item-0");
    });

    it("triggers refreshAccount when Enter is pressed on the active item", async () => {
      const mockRefresh = vi.fn();
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          address: ADDRESS,
          isConnected: true,
          balances: [makeBalance()],
          refreshAccount: mockRefresh,
        }),
      );
      render(<AccountSidebar open={true} onClose={vi.fn()} />);
      await flushTxFetch();
      const listbox = screen.getByRole("listbox", { name: "Account balances" });
      fireEvent.keyDown(listbox, { key: "Enter" });
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });

    it("selects an item by clicking it directly", async () => {
      renderWithBalances();
      await flushTxFetch();
      const options = getBalanceOptions();
      fireEvent.click(options[2]);
      expect(options[2]).toHaveAttribute("aria-selected", "true");
      expect(
        screen.getByRole("listbox", { name: "Account balances" }),
      ).toHaveAttribute("aria-activedescendant", "balance-item-2");
    });
  });

  // ── Collapsed-state persistence across remounts (#890) ──────────────────
  describe("collapsed-state persistence across unmount/remount", () => {
    it("preserves the collapsed selection when the sidebar unmounts and remounts", async () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({ address: ADDRESS, isConnected: true }),
      );
      const { unmount } = render(<AccountSidebar open={true} onClose={vi.fn()} />);
      await flushTxFetch();

      fireEvent.click(screen.getByRole("button", { name: "Collapse account sidebar" }));
      expect(screen.queryByText("Account")).not.toBeInTheDocument();

      // Simulate the real unmount/remount cycle the issue describes (e.g. the
      // host app conditionally rendering <AccountSidebar> rather than only
      // toggling its `open` prop).
      unmount();
      render(<AccountSidebar open={true} onClose={vi.fn()} />);
      await flushTxFetch();

      expect(screen.queryByText("Account")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Expand account sidebar" })).toBeInTheDocument();
    });
  });

  // ── Settings: language + biometric toggles (#1152, #1157) ───────────────
  describe("language and biometric settings", () => {
    it("changes and persists the active language from the settings selector", async () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({ address: ADDRESS, isConnected: true }),
      );
      render(
        <I18nProvider>
          <AccountSidebar open={true} onClose={vi.fn()} />
        </I18nProvider>,
      );
      await flushTxFetch();

      const selector = screen.getByLabelText("Language");
      expect(selector).toHaveValue("en");
      fireEvent.change(selector, { target: { value: "es" } });

      expect(localStorage.getItem("sorokit_locale")).toBe("es");
      expect(screen.getByText("Configuración")).toBeInTheDocument();
      expect(screen.getByText("Actualizar saldos")).toBeInTheDocument();
    });

    it("disables the biometric toggle with guidance when WebAuthn is unavailable", async () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({ address: ADDRESS, isConnected: true }),
      );
      const win = window as unknown as { PublicKeyCredential?: unknown };
      const original = win.PublicKeyCredential;
      delete win.PublicKeyCredential;
      try {
        render(
          <I18nProvider>
            <AccountSidebar open={true} onClose={vi.fn()} />
          </I18nProvider>,
        );
        await flushTxFetch();

        expect(screen.getByLabelText("Biometric unlock")).toBeDisabled();
        expect(
          screen.getByText("Biometric unlock is not available in this browser."),
        ).toBeInTheDocument();
      } finally {
        win.PublicKeyCredential = original;
      }
    });
  });
});
