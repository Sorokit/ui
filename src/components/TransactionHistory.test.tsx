import { act,fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach,describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import type { SorokitClient, Transaction } from "@/lib/client";
import { getClient } from "@/lib/client";

import { TransactionHistory } from "./TransactionHistory";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

vi.mock("@/lib/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/client")>();
  return {
    ...actual,
    getClient: vi.fn(),
  };
});

const ADDRESS = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA";
const PAGE_SIZE = 10;

function makeTx(i: number): Transaction {
  return {
    hash: `hash${String(i).padStart(56, "0")}`,
    ledger: 1000 + i,
    successful: true,
    createdAt: new Date("2024-01-01").toISOString(),
    memo: null,
  };
}

const mockClient = {
  transaction: {
    getHistory: vi.fn().mockResolvedValue({ data: [], error: null, total: 0 }),
  },
} as unknown as SorokitClient;

function mockGetHistory(txs: Transaction[], total: number) {
  mockClient.transaction.getHistory = vi.fn().mockResolvedValue({ data: txs, error: null, total });
}

/**
 * Builds a useSorokit() mock return value with `client` wired to the
 * getClient mock, matching how the real useSorokit() sources it. Every
 * override in this file must go through this helper — a plain object
 * literal has no `client` key, which makes TransactionHistory's
 * `if (!client) return;` guard silently skip every fetch.
 */
function mockUseSorokit(
  overrides: Partial<ReturnType<typeof useSorokit>>,
): ReturnType<typeof useSorokit> {
  return {
    ...overrides,
    get client() {
      return "client" in overrides ? overrides.client : getClient();
    },
  } as unknown as ReturnType<typeof useSorokit>;
}

describe("TransactionHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockClient.transaction.getHistory = vi.fn().mockResolvedValue({ data: [], error: null, total: 0 });
    vi.mocked(getClient).mockReturnValue(mockClient);
    vi.mocked(useSorokit).mockImplementation(() =>
      mockUseSorokit({ address: ADDRESS, isConnected: true }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders 'Connect your wallet' when not connected", () => {
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokit({ address: null, isConnected: false }),
    );
    vi.mocked(getClient).mockReturnValue({
      transaction: { getHistory: vi.fn() },
    } as unknown as SorokitClient);

    render(<TransactionHistory />);
    expect(screen.getByText(/connect your wallet/i)).toBeInTheDocument();
  });

  it("renders the empty state with icon and message on testnet", async () => {
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokit({
        address: ADDRESS,
        isConnected: true,
        network: { name: "testnet" } as ReturnType<typeof useSorokit>["network"],
      }),
    );
    mockGetHistory([], 0);
    const { container } = render(<TransactionHistory />);
    act(() => { vi.advanceTimersByTime(0); });

    await waitFor(() => {
      expect(screen.getByText("No transactions yet")).toBeInTheDocument();
    });
    const iconContainer = container.querySelector('[aria-hidden="true"]');
    expect(iconContainer).toBeInTheDocument();
    expect(iconContainer?.querySelector("svg")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /fund with friendbot/i })).toHaveAttribute(
      "href",
      "https://friendbot.stellar.org",
    );
  });

  it("does not show Friendbot outside testnet", async () => {
    mockGetHistory([], 0);
    render(<TransactionHistory />);
    act(() => { vi.advanceTimersByTime(0); });

    await screen.findByText("No transactions yet");
    expect(screen.queryByRole("link", { name: /friendbot/i })).not.toBeInTheDocument();
  });

  it("does not render pagination when total ≤ PAGE_SIZE", async () => {
    const txs = Array.from({ length: PAGE_SIZE }, (_, i) => makeTx(i));
    mockGetHistory(txs, PAGE_SIZE);
    render(<TransactionHistory />);
    act(() => { vi.advanceTimersByTime(0); });

    await waitFor(() => screen.getByText(/1000/)); // first tx's ledger
    expect(screen.queryByText("Prev")).not.toBeInTheDocument();
    expect(screen.queryByText("Next")).not.toBeInTheDocument();
  });

  it("renders pagination controls when total > PAGE_SIZE", async () => {
    const txs = Array.from({ length: PAGE_SIZE }, (_, i) => makeTx(i));
    mockGetHistory(txs, PAGE_SIZE + 1); // 11 total → 2 pages
    render(<TransactionHistory />);
    act(() => { vi.advanceTimersByTime(0); });

    await waitFor(() => {
      expect(screen.getByText("Prev")).toBeInTheDocument();
      expect(screen.getByText("Next")).toBeInTheDocument();
    });
  });

  it("disables Prev button on page 1", async () => {
    const txs = Array.from({ length: PAGE_SIZE }, (_, i) => makeTx(i));
    mockGetHistory(txs, 25);
    render(<TransactionHistory />);
    act(() => { vi.advanceTimersByTime(0); });

    await waitFor(() => screen.getByText("Prev"));
    const prevBtn = screen.getByRole("button", { name: /prev/i });
    expect(prevBtn).toBeDisabled();
  });

  it("clicking Next increments the page and calls getHistory with page 2", async () => {
    const getHistory = vi.fn().mockResolvedValue({
      data: Array.from({ length: PAGE_SIZE }, (_, i) => makeTx(i)),
      error: null,
      total: 25,
    });
    mockClient.transaction.getHistory = getHistory;

    render(<TransactionHistory />);
    act(() => { vi.advanceTimersByTime(0); });
    await waitFor(() => screen.getByText("Next"));
    expect(getHistory).toHaveBeenCalledWith(ADDRESS, 1, PAGE_SIZE);

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    act(() => { vi.advanceTimersByTime(0); });

    await waitFor(() => {
      expect(getHistory).toHaveBeenCalledWith(ADDRESS, 2, PAGE_SIZE);
    });
  });

  it("resets page to 1, clears total and txs when wallet address changes (#578)", async () => {
    const ADDRESS_B = "GBBD7PQPDHFWD6Q5CFF3J4L3R75EAE6Z4NZZ2QY6M2G4K4W4P6N3X2B1";
    const getHistory = vi.fn().mockImplementation((addr: string, _page: number) => {
      if (addr === ADDRESS) {
        return Promise.resolve({
          data: Array.from({ length: PAGE_SIZE }, (_, i) => makeTx(i)),
          error: null,
          total: 30, // 3 pages
        });
      }
      return Promise.resolve({
        data: [makeTx(99)],
        error: null,
        total: 1, // 1 page
      });
    });

    vi.mocked(getClient).mockReturnValue({
      transaction: { getHistory },
    } as unknown as SorokitClient);

    const { rerender } = render(<TransactionHistory />);
    act(() => { vi.advanceTimersByTime(0); });
    await waitFor(() => screen.getByText("Next"));

    // Navigate to page 2 on account A
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    act(() => { vi.advanceTimersByTime(0); });
    await waitFor(() => {
      expect(getHistory).toHaveBeenCalledWith(ADDRESS, 2, PAGE_SIZE);
    });

    // Switch wallet address to account B
    vi.mocked(useSorokit).mockReturnValue({ address: ADDRESS_B, isConnected: true, get client() { return getClient(); },  } as unknown as ReturnType<typeof useSorokit>);

    rerender(<TransactionHistory />);
    act(() => { vi.advanceTimersByTime(0); });

    await waitFor(() => {
      expect(getHistory).toHaveBeenCalledWith(ADDRESS_B, 1, PAGE_SIZE);
    });

    // Verify page 2 was never requested for account B
    expect(getHistory).not.toHaveBeenCalledWith(ADDRESS_B, 2, PAGE_SIZE);
    expect(getHistory).not.toHaveBeenCalledWith(ADDRESS_B, 3, PAGE_SIZE);
  });

  it("clears total and transactions before new fetch completes when address changes (#578)", async () => {
    const ADDRESS_B = "GBBD7PQPDHFWD6Q5CFF3J4L3R75EAE6Z4NZZ2QY6M2G4K4W4P6N3X2B1";
    let resolveAccountB: (value: unknown) => void;
    const pendingPromise = new Promise((resolve) => {
      resolveAccountB = resolve;
    });

    const getHistory = vi.fn().mockImplementation((addr: string) => {
      if (addr === ADDRESS) {
        return Promise.resolve({
          data: Array.from({ length: PAGE_SIZE }, (_, i) => makeTx(i)),
          error: null,
          total: 25,
        });
      }
      return pendingPromise;
    });

    vi.mocked(getClient).mockReturnValue({
      transaction: { getHistory },
    } as unknown as SorokitClient);

    const { rerender } = render(<TransactionHistory />);
    act(() => { vi.advanceTimersByTime(0); });
    await waitFor(() => screen.getByText(/25 transactions/i));

    // Switch wallet address to account B (fetch remains pending)
    vi.mocked(useSorokit).mockReturnValue({ address: ADDRESS_B, isConnected: true, get client() { return getClient(); },  } as unknown as ReturnType<typeof useSorokit>);

    rerender(<TransactionHistory />);
    act(() => { vi.advanceTimersByTime(0); });

    // The stale total counter ("25 transactions") and stale pagination should be gone
    expect(screen.queryByText(/25 transactions/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/page \d+ of/i)).not.toBeInTheDocument();

    // Resolve Account B fetch
    act(() => {
      resolveAccountB({
        data: [makeTx(1)],
        error: null,
        total: 1,
      });
      vi.advanceTimersByTime(0);
    });

    await waitFor(() => {
      expect(screen.getByText(/1 transaction/i)).toBeInTheDocument();
    });
  });

  it("handles an invalid total without rendering invalid pagination", async () => {
    mockGetHistory([], Number.NaN);
    render(<TransactionHistory />);
    act(() => { vi.advanceTimersByTime(0); });

    await screen.findByText("No transactions yet");
    expect(screen.queryByText(/page .* of/i)).not.toBeInTheDocument();
  });

  it("disables Next button on the last page", async () => {
    const getHistory = vi.fn().mockResolvedValue({
      data: Array.from({ length: 5 }, (_, i) => makeTx(i)),
      error: null,
      total: 15,
    });
    mockClient.transaction.getHistory = getHistory;

    render(<TransactionHistory />);
    act(() => { vi.advanceTimersByTime(0); });
    await waitFor(() => screen.getByText("Next"));

    // Navigate to page 2 (last page for total=15, pageSize=10)
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    act(() => { vi.advanceTimersByTime(0); });

    await waitFor(() => {
      expect(screen.getByText(/page 2 of 2/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  it("clicking Prev decrements the page and re-fetches page 1", async () => {
    const getHistory = vi.fn().mockResolvedValue({
      data: Array.from({ length: PAGE_SIZE }, (_, i) => makeTx(i)),
      error: null,
      total: 25,
    });
    mockClient.transaction.getHistory = getHistory;

    render(<TransactionHistory />);
    act(() => { vi.advanceTimersByTime(0); });
    await waitFor(() => screen.getByText("Next"));

    // Go forward to page 2…
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    act(() => { vi.advanceTimersByTime(0); });
    await waitFor(() =>
      expect(getHistory).toHaveBeenCalledWith(ADDRESS, 2, PAGE_SIZE),
    );

    // …then back to page 1 via Prev.
    fireEvent.click(screen.getByRole("button", { name: /prev/i }));
    act(() => { vi.advanceTimersByTime(0); });
    await waitFor(() => {
      expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
    });
    expect(getHistory).toHaveBeenLastCalledWith(ADDRESS, 1, PAGE_SIZE);
    // Prev is disabled again on the first page.
    expect(screen.getByRole("button", { name: /prev/i })).toBeDisabled();
  });

  describe("pagination reset on address change (#525)", () => {
    const OTHER_ADDRESS = "GBQMSN2ZQMXK5OBRXV5MTZ3PB4DTJVBQZTIEZTBAGMNIJ4XWVCPMFRPD";

    it("never reuses the previous account's page number after an address change", async () => {
      // Page persistence via sessionStorage was removed (fc66b90); the
      // regression contract is that a page reached for one address can never
      // leak into the next account's requests.
      const getHistory = vi.fn().mockImplementation((addr: string) => {
        if (addr === ADDRESS) {
          return Promise.resolve({
            data: Array.from({ length: PAGE_SIZE }, (_, i) => makeTx(i)),
            error: null,
            total: 25, // 3 pages
          });
        }
        return Promise.resolve({
          data: [makeTx(0)],
          error: null,
          total: 1, // 1 page
        });
      });
      vi.mocked(getClient).mockReturnValue({
        transaction: { getHistory },
      } as unknown as SorokitClient);

      const { rerender } = render(<TransactionHistory />);
      act(() => { vi.advanceTimersByTime(0); });
      await waitFor(() => screen.getByText("Next"));

      // Reach page 2 for the original wallet.
      fireEvent.click(screen.getByRole("button", { name: /next/i }));
      act(() => { vi.advanceTimersByTime(0); });
      await waitFor(() =>
        expect(getHistory).toHaveBeenCalledWith(ADDRESS, 2, PAGE_SIZE),
      );

      getHistory.mockClear();

      // Switch to a different wallet whose history only has one page.
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({ address: OTHER_ADDRESS, isConnected: true }),
      );
      rerender(<TransactionHistory />);
      act(() => { vi.advanceTimersByTime(0); });

      // The stale page-2 state must never be requested for the new address —
      // the reset effect fires before the fetch effect.
      expect(getHistory).not.toHaveBeenCalledWith(OTHER_ADDRESS, 2, PAGE_SIZE);
      await waitFor(() =>
        expect(getHistory).toHaveBeenCalledWith(OTHER_ADDRESS, 1, PAGE_SIZE),
      );
      expect(screen.queryByText(/page \d+ of/i)).not.toBeInTheDocument();
      expect(screen.queryByText("Prev")).not.toBeInTheDocument();
    });

    it("clears previously rendered rows immediately so no stale transactions flash for the new address", async () => {
      const getHistory = vi
        .fn()
        .mockResolvedValueOnce({ data: [makeTx(0)], error: null, total: 1 })
        .mockImplementationOnce(
          () => new Promise(() => {}), // never resolves — simulates an in-flight fetch
        );
      vi.mocked(getClient).mockReturnValue({
        transaction: { getHistory },
      } as unknown as SorokitClient);

      const { rerender } = render(<TransactionHistory />);
      act(() => { vi.advanceTimersByTime(0); });
      await waitFor(() => screen.getByRole("article"));

      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({ address: OTHER_ADDRESS, isConnected: true }),
      );
      rerender(<TransactionHistory />);
      act(() => { vi.advanceTimersByTime(0); });

      expect(screen.queryByRole("article")).not.toBeInTheDocument();
    });
  });

  describe("row links to Stellar Expert (#350)", () => {
    it("links each row to its Stellar Expert transaction page on testnet", async () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          address: ADDRESS,
          isConnected: true,
          network: { name: "testnet" } as ReturnType<typeof useSorokit>["network"],
        }),
      );
      const tx = makeTx(0);
      mockGetHistory([tx], 1);

      render(<TransactionHistory />);
      act(() => { vi.advanceTimersByTime(0); });

      // The row carries an explicit role="article" (ARIA: an explicit role
      // overrides the <a> tag's implicit "link" role), so query by article
      // and assert on its href directly rather than by role="link".
      await waitFor(() => screen.getByRole("article"));
      expect(screen.getByRole("article")).toHaveAttribute(
        "href",
        `https://stellar.expert/explorer/testnet/tx/${tx.hash}`,
      );
    });

    it("links each row to its Stellar Expert transaction page on mainnet", async () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          address: ADDRESS,
          isConnected: true,
          network: { name: "mainnet" } as ReturnType<typeof useSorokit>["network"],
        }),
      );
      const tx = makeTx(0);
      mockGetHistory([tx], 1);

      render(<TransactionHistory />);
      act(() => { vi.advanceTimersByTime(0); });

      await waitFor(() => screen.getByRole("article"));
      expect(screen.getByRole("article")).toHaveAttribute(
        "href",
        `https://stellar.expert/explorer/public/tx/${tx.hash}`,
      );
    });

    it("renders a plain (non-link) row when the network is unrecognized", async () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          address: ADDRESS,
          isConnected: true,
          network: { name: "futurenet" } as ReturnType<typeof useSorokit>["network"],
        }),
      );
      const tx = makeTx(0);
      mockGetHistory([tx], 1);

      render(<TransactionHistory />);
      act(() => { vi.advanceTimersByTime(0); });

      await waitFor(() => screen.getByRole("article"));
      const row = screen.getByRole("article");
      expect(row.tagName).toBe("DIV");
      expect(row).not.toHaveAttribute("href");
    });

    it("mentions the explorer link in the row's aria-label when it is one (#563)", async () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          address: ADDRESS,
          isConnected: true,
          network: { name: "testnet" } as ReturnType<typeof useSorokit>["network"],
        }),
      );
      const tx = makeTx(0);
      mockGetHistory([tx], 1);

      render(<TransactionHistory />);
      act(() => { vi.advanceTimersByTime(0); });

      await waitFor(() => screen.getByRole("article"));
      expect(screen.getByRole("article")).toHaveAccessibleName(
        expect.stringMatching(/stellar expert.*opens in a new tab/i),
      );
    });

    it("does not mention an explorer link in the aria-label for a non-link row (#563)", async () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          address: ADDRESS,
          isConnected: true,
          network: { name: "futurenet" } as ReturnType<typeof useSorokit>["network"],
        }),
      );
      const tx = makeTx(0);
      mockGetHistory([tx], 1);

      render(<TransactionHistory />);
      act(() => { vi.advanceTimersByTime(0); });

      await waitFor(() => screen.getByRole("article"));
      expect(screen.getByRole("article")).not.toHaveAccessibleName(
        expect.stringMatching(/stellar expert/i),
      );
    });
  });

  describe("status and date range filtering (#350, #352)", () => {
    function makeTxAt(hashSuffix: string, iso: string, successful: boolean): Transaction {
      return {
        hash: `hash${hashSuffix.padStart(56, "0")}`,
        ledger: 2000,
        successful,
        createdAt: new Date(iso).toISOString(),
        memo: null,
      };
    }

    it("the status filter shows only successful transactions when 'Success' is selected", async () => {
      const ok = makeTxAt("1", "2024-02-01", true);
      const failed = makeTxAt("2", "2024-02-02", false);
      mockGetHistory([ok, failed], 2);

      render(<TransactionHistory />);
      act(() => { vi.advanceTimersByTime(0); });
      await waitFor(() => screen.getAllByRole("article"));
      expect(screen.getAllByRole("article")).toHaveLength(2);

      fireEvent.click(screen.getByRole("button", { name: /^success$/i }));

      const rows = screen.getAllByRole("article");
      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveTextContent(ok.hash.slice(0, 10));
    });

    it("the status filter shows only failed transactions when 'Failed' is selected", async () => {
      const ok = makeTxAt("1", "2024-02-01", true);
      const failed = makeTxAt("2", "2024-02-02", false);
      mockGetHistory([ok, failed], 2);

      render(<TransactionHistory />);
      act(() => { vi.advanceTimersByTime(0); });
      await waitFor(() => screen.getAllByRole("article"));

      fireEvent.click(screen.getByRole("button", { name: /^failed$/i }));

      const rows = screen.getAllByRole("article");
      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveTextContent(failed.hash.slice(0, 10));
    });

    it("'All' shows every transaction regardless of status", async () => {
      const ok = makeTxAt("1", "2024-02-01", true);
      const failed = makeTxAt("2", "2024-02-02", false);
      mockGetHistory([ok, failed], 2);

      render(<TransactionHistory />);
      act(() => { vi.advanceTimersByTime(0); });
      await waitFor(() => screen.getAllByRole("article"));

      fireEvent.click(screen.getByRole("button", { name: /^failed$/i }));
      expect(screen.getAllByRole("article")).toHaveLength(1);

      fireEvent.click(screen.getByRole("button", { name: /^all$/i }));
      expect(screen.getAllByRole("article")).toHaveLength(2);
    });

    it("startDate excludes transactions before the given date", async () => {
      const early = makeTxAt("1", "2024-01-01", true);
      const late = makeTxAt("2", "2024-03-01", true);
      mockGetHistory([early, late], 2);

      render(<TransactionHistory startDate="2024-02-01" />);
      act(() => { vi.advanceTimersByTime(0); });

      await waitFor(() => screen.getAllByRole("article"));
      const rows = screen.getAllByRole("article");
      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveTextContent(late.hash.slice(0, 10));
    });

    it("endDate excludes transactions after the given date", async () => {
      const early = makeTxAt("1", "2024-01-01", true);
      const late = makeTxAt("2", "2024-03-01", true);
      mockGetHistory([early, late], 2);

      render(<TransactionHistory endDate="2024-02-01" />);
      act(() => { vi.advanceTimersByTime(0); });

      await waitFor(() => screen.getAllByRole("article"));
      const rows = screen.getAllByRole("article");
      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveTextContent(early.hash.slice(0, 10));
    });

    it("startDate and endDate together narrow to the transactions within range", async () => {
      const before = makeTxAt("1", "2024-01-01", true);
      const within = makeTxAt("2", "2024-02-15", true);
      const after = makeTxAt("3", "2024-03-01", true);
      mockGetHistory([before, within, after], 3);

      render(<TransactionHistory startDate="2024-02-01" endDate="2024-02-28" />);
      act(() => { vi.advanceTimersByTime(0); });

      await waitFor(() => screen.getAllByRole("article"));
      const rows = screen.getAllByRole("article");
      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveTextContent(within.hash.slice(0, 10));
    });

    it("combines the status filter and date range together", async () => {
      const withinOk = makeTxAt("1", "2024-02-10", true);
      const withinFailed = makeTxAt("2", "2024-02-11", false);
      const outsideOk = makeTxAt("3", "2024-05-01", true);
      mockGetHistory([withinOk, withinFailed, outsideOk], 3);

      render(<TransactionHistory startDate="2024-02-01" endDate="2024-02-28" />);
      act(() => { vi.advanceTimersByTime(0); });
      await waitFor(() => screen.getAllByRole("article"));
      expect(screen.getAllByRole("article")).toHaveLength(2);

      fireEvent.click(screen.getByRole("button", { name: /^success$/i }));

      const rows = screen.getAllByRole("article");
      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveTextContent(withinOk.hash.slice(0, 10));
    });
  });

  describe("fee total, multi-op filter, and trend sparkline", () => {
    /** Builds a tx with an explicit fee and operation count. */
    function makeFeeTx(
      id: string,
      feePaid: string,
      operationCount: number,
      createdAt = "2024-01-01",
    ): Transaction {
      return {
        hash: `hash${id.padStart(56, "0")}`,
        ledger: 1000,
        successful: true,
        createdAt: new Date(createdAt).toISOString(),
        memo: null,
        feePaid,
        operationCount,
      } as unknown as Transaction;
    }

    async function renderWith(txs: Transaction[], props = {}) {
      mockGetHistory(txs, txs.length);
      render(<TransactionHistory {...props} />);
      act(() => { vi.advanceTimersByTime(0); });
      await waitFor(() => screen.getAllByRole("article"));
    }

    it("sums feePaid across displayed transactions in the footer", async () => {
      await renderWith([
        makeFeeTx("1", "100", 1),
        makeFeeTx("2", "250", 1),
        makeFeeTx("3", "150", 1),
      ]);

      const footer = document.querySelector("[data-fee-total]");
      expect(footer).toHaveTextContent("Total fees: 500 stroops");
      expect(footer).toHaveTextContent("0.00005 XLM");
    });

    it("ignores unparseable fee values instead of rendering NaN", async () => {
      await renderWith([
        makeFeeTx("1", "100", 1),
        makeFeeTx("2", "not-a-number", 1),
      ]);

      const footer = document.querySelector("[data-fee-total]");
      expect(footer).toHaveTextContent("Total fees: 100 stroops");
      expect(footer?.textContent).not.toMatch(/NaN/);
    });

    it("filters to multi-operation transactions when Multi-op is toggled", async () => {
      await renderWith([
        makeFeeTx("1", "100", 1),
        makeFeeTx("2", "100", 3),
        makeFeeTx("3", "100", 1),
      ]);
      expect(screen.getAllByRole("article")).toHaveLength(3);

      const toggle = screen.getByRole("button", { name: /multi-op/i });
      fireEvent.click(toggle);

      expect(toggle).toHaveAttribute("aria-pressed", "true");
      const rows = screen.getAllByRole("article");
      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveTextContent("3 ops");

      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute("aria-pressed", "false");
      expect(screen.getAllByRole("article")).toHaveLength(3);
    });

    it("recomputes the fee total from the filtered set", async () => {
      await renderWith([
        makeFeeTx("1", "100", 1),
        makeFeeTx("2", "700", 2),
      ]);
      expect(document.querySelector("[data-fee-total]")).toHaveTextContent(
        "Total fees: 800 stroops",
      );

      fireEvent.click(screen.getByRole("button", { name: /multi-op/i }));
      expect(document.querySelector("[data-fee-total]")).toHaveTextContent(
        "Total fees: 700 stroops",
      );
    });

    it("hides the trend sparkline unless showTrend is set", async () => {
      await renderWith([makeFeeTx("1", "100", 1)]);
      expect(document.querySelectorAll("[data-trend-bar]")).toHaveLength(0);
    });

    it("renders a 7-bar sparkline when showTrend is set", async () => {
      await renderWith([makeFeeTx("1", "100", 1)], { showTrend: true });
      expect(document.querySelectorAll("[data-trend-bar]")).toHaveLength(7);
    });

    it("scales sparkline bars by each day's transaction count", async () => {
      const today = new Date();
      const yesterday = new Date(today.getTime() - 86_400_000);
      await renderWith(
        [
          makeFeeTx("1", "100", 1, today.toISOString()),
          makeFeeTx("2", "100", 1, today.toISOString()),
          makeFeeTx("3", "100", 1, yesterday.toISOString()),
        ],
        { showTrend: true },
      );

      const bars = document.querySelectorAll("[data-trend-bar]");
      // Buckets are oldest-first, so today is the last bar and yesterday the one before.
      expect(bars[6]).toHaveAttribute("title", "2 transactions");
      expect(bars[5]).toHaveAttribute("title", "1 transaction");
      expect(bars[0]).toHaveAttribute("title", "0 transactions");
      expect((bars[6] as HTMLElement).style.height).toBe("100%");
      expect((bars[5] as HTMLElement).style.height).toBe("50%");
    });
  });

  describe("loading skeleton and error state", () => {
    it("renders 5 placeholder rows during initial fetch", async () => {
      let resolveGetHistory: (v: { data: Transaction[]; error: null; total: number }) => void;
      const getHistory = vi.fn().mockImplementation(
        () => new Promise((resolve) => { resolveGetHistory = resolve; }),
      );
      mockClient.transaction.getHistory = getHistory;

      render(<TransactionHistory />);
      act(() => { vi.advanceTimersByTime(0); });

      // 5 skeleton placeholder rows should be visible while loading
      const skeletons = document.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBeGreaterThanOrEqual(5);

      // Resolve the fetch so loading ends
      await act(async () => {
        resolveGetHistory!({ data: [], error: null, total: 0 });
        await new Promise((r) => setTimeout(r, 0));
      });
    });

    it("renders the error message when getHistory returns an error", async () => {
      mockClient.transaction.getHistory = vi.fn().mockResolvedValue({
        data: null,
        error: "Network request failed",
        total: 0,
      });

      render(<TransactionHistory />);
      act(() => { vi.advanceTimersByTime(0); });

      await waitFor(() => {
        expect(screen.getByText("Network request failed")).toBeInTheDocument();
      });
    });
  });

  describe("address change resets to page 1", () => {
    it("resets to page 1 when the wallet address changes", async () => {
      const getHistory = vi.fn().mockResolvedValue({
        data: Array.from({ length: PAGE_SIZE }, (_, i) => makeTx(i)),
        error: null,
        total: 25,
      });
      mockClient.transaction.getHistory = getHistory;

      const { rerender } = render(<TransactionHistory />);
      act(() => { vi.advanceTimersByTime(0); });
      await waitFor(() => screen.getByText("Next"));

      // Navigate to page 2
      fireEvent.click(screen.getByRole("button", { name: /next/i }));
      act(() => { vi.advanceTimersByTime(0); });
      await waitFor(() => {
        expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument();
      });

      getHistory.mockClear();

      // Change the address via the mocked hook
      const NEW_ADDRESS = "GNEWADDRESS12345678901234567890123456789012345678901234";
      vi.mocked(useSorokit).mockReturnValue({ address: NEW_ADDRESS, isConnected: true, get client() { return getClient(); },
      } as unknown as ReturnType<typeof useSorokit>);

      rerender(<TransactionHistory />);
      act(() => { vi.advanceTimersByTime(0); });

      // Should fetch page 1 for the new address
      await waitFor(() => {
        expect(getHistory).toHaveBeenCalledWith(NEW_ADDRESS, 1, PAGE_SIZE);
      });
    });
  });
});
