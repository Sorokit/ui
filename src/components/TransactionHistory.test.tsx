import { act,fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach,describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import type { SorokitClient, Transaction } from "@/lib/client";
import { getClient } from "@/lib/client";

import { TransactionHistory } from "./TransactionHistory";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));
vi.mock("@/lib/client", () => ({
  getClient: vi.fn(),
}));

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

function mockGetHistory(txs: Transaction[], total: number) {
  vi.mocked(getClient).mockReturnValue({
    transaction: {
      getHistory: vi.fn().mockResolvedValue({ data: txs, error: null, total }),
    },
  } as unknown as SorokitClient);
}

describe("TransactionHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(useSorokit).mockReturnValue({
      address: ADDRESS,
      isConnected: true,
    } as unknown as ReturnType<typeof useSorokit>);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders 'Connect your wallet' when not connected", () => {
    vi.mocked(useSorokit).mockReturnValue({
      address: null,
      isConnected: false,
    } as unknown as ReturnType<typeof useSorokit>);
    vi.mocked(getClient).mockReturnValue({
      transaction: { getHistory: vi.fn() },
    } as unknown as SorokitClient);

    render(<TransactionHistory />);
    expect(screen.getByText(/connect your wallet/i)).toBeInTheDocument();
  });

  it("renders 'No transactions found' when the list is empty", async () => {
    mockGetHistory([], 0);
    render(<TransactionHistory />);
    act(() => { vi.advanceTimersByTime(0); });

    await waitFor(() => {
      expect(screen.getByText("No transactions found")).toBeInTheDocument();
    });
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
    vi.mocked(getClient).mockReturnValue({
      transaction: { getHistory },
    } as unknown as SorokitClient);

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

  it("disables Next button on the last page", async () => {
    const getHistory = vi.fn().mockResolvedValue({
      data: Array.from({ length: 5 }, (_, i) => makeTx(i)),
      error: null,
      total: 15,
    });
    vi.mocked(getClient).mockReturnValue({
      transaction: { getHistory },
    } as unknown as SorokitClient);

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
    vi.mocked(getClient).mockReturnValue({
      transaction: { getHistory },
    } as unknown as SorokitClient);

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
});
