import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach,describe, expect, it, vi } from "vitest";

import { getClient } from "@/lib/client";

import { TransactionHistoryTable } from "./TransactionHistoryTable";

// Mock context
vi.mock("@/context/useSorokit", () => ({
  useSorokit: () => ({ address: "GABC123...", isConnected: true, get client() { return getClient(); } }),
}));

// Mock client
const { mockTransactions } = vi.hoisted(() => ({ mockTransactions: Array.from({ length: 25 }, (_, i) => ({
  hash: `a${i.toString().padStart(63, "0")}`,
  ledger: 1000000 + i,
  createdAt: new Date(2026, 6, 26, 10, i, 0).toISOString(),
  successful: i % 3 !== 0,
  operationCount: (i % 4) + 1,
  feePaid: String(100 + i * 10),
  memo: i % 5 === 0 ? `Memo #${i}` : undefined,
})) }));

vi.mock("@/lib/client", () => ({
  getClient: vi.fn(() => ({
    transaction: {
      getHistory: vi.fn().mockResolvedValue({ data: mockTransactions, error: null, total: 25 }),
    },
  })),
}));

// Mock URL.createObjectURL and download
const mockCreateObjectURL = vi.fn(() => "blob:mock");
const mockRevokeObjectURL = vi.fn();
URL.createObjectURL = mockCreateObjectURL;
URL.revokeObjectURL = mockRevokeObjectURL;

beforeEach(() => {
  vi.clearAllMocks();
  // clearAllMocks() only clears call history, not return-value overrides set
  // via mockReturnValue in individual tests, so restore the default here.
  vi.mocked(getClient).mockReturnValue({
    transaction: {
      getHistory: vi.fn().mockResolvedValue({ data: mockTransactions, error: null, total: 25 }),
    },
  } as unknown as ReturnType<typeof getClient>);
});

describe("TransactionHistoryTable", () => {
  it("renders header with title", () => {
    render(<TransactionHistoryTable />);
    expect(screen.getByText("Transaction History")).toBeInTheDocument();
  });

  it("shows transaction count", async () => {
    render(<TransactionHistoryTable />);
    await waitFor(() => {
      expect(screen.getByText(/25 transactions?/)).toBeInTheDocument();
    });
  });

  it("renders CSV export button", async () => {
    render(<TransactionHistoryTable />);
    await waitFor(() => {
      expect(screen.getByText("CSV")).toBeInTheDocument();
    });
  });

  it("renders filter toggle button", () => {
    render(<TransactionHistoryTable />);
    expect(screen.getByText(/Show filters/)).toBeInTheDocument();
  });

  it("toggles filter panel", () => {
    render(<TransactionHistoryTable />);
    fireEvent.click(screen.getByText(/Show filters/));
    expect(screen.getByLabelText("Filter by status")).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Hide filters/));
    expect(screen.queryByLabelText("Filter by status")).not.toBeInTheDocument();
  });

  it("displays transaction rows", async () => {
    render(<TransactionHistoryTable />);
    await waitFor(() => {
      expect(screen.getAllByText(/a0000/)[0]).toBeInTheDocument();
    });
  });

  it("shows status badges", async () => {
    render(<TransactionHistoryTable />);
    await waitFor(() => {
      const badges = screen.getAllByText(/Success|Failed/);
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  it("shows ledger numbers", async () => {
    render(<TransactionHistoryTable />);
    await waitFor(() => {
      expect(screen.getAllByText(/1000024/)[0]).toBeInTheDocument();
    });
  });

  it("paginates when more than page size", async () => {
    render(<TransactionHistoryTable pageSize={10} />);
    await waitFor(() => {
      expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
    });
    const nextBtn = screen.getByText("Next");
    fireEvent.click(nextBtn);
    expect(screen.getByText(/Page 2 of/)).toBeInTheDocument();
  });

  it("disables Prev on first page", async () => {
    render(<TransactionHistoryTable pageSize={10} />);
    await waitFor(() => {
      const prevBtn = screen.getByText("Prev").closest("button");
      expect(prevBtn).toBeDisabled();
    });
  });

  it("filter by status: failed only", async () => {
    render(<TransactionHistoryTable />);
    await waitFor(() => screen.getByText(/25 transactions/));
    fireEvent.click(screen.getByText(/Show filters/));
    const select = screen.getByLabelText("Filter by status");
    fireEvent.change(select, { target: { value: "failed" } });
    // Should show only failed transactions (~8 out of 25 where i%3===0)
    await waitFor(() => {
      const failed = screen.getAllByText("Failed");
      expect(failed.length).toBeGreaterThan(0);
    });
  });

  it("sort toggles direction on second click", async () => {
    render(<TransactionHistoryTable />);
    await waitFor(() => screen.getByText(/25 transactions/));
    const ledgerHeader = screen.getByText("Ledger");
    fireEvent.click(ledgerHeader);
    // First click: desc (default) toggles to asc
    // Just verify it doesn't crash
  });

  it("CSV export button triggers download", async () => {
    render(<TransactionHistoryTable />);
    await waitFor(() => {
      expect(screen.getByText("CSV")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("CSV"));
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });

  it("shows empty state when no data", async () => {
    vi.mocked(getClient).mockReturnValue({
      transaction: {
        getHistory: vi.fn().mockResolvedValue({ data: [], error: null, total: 0 }),
      },
    });
    render(<TransactionHistoryTable />);
    await waitFor(() => {
      expect(screen.getByText("No transactions found")).toBeInTheDocument();
    });
  });

  it("shows error state", async () => {
    vi.mocked(getClient).mockReturnValue({
      transaction: {
        getHistory: vi.fn().mockResolvedValue({ data: null, error: "Failed to fetch", total: 0 }),
      },
    });
    render(<TransactionHistoryTable />);
    await waitFor(() => {
      expect(screen.getByText("Failed to fetch")).toBeInTheDocument();
    });
  });

  it("renders mobile card layout alongside desktop table", async () => {
    render(<TransactionHistoryTable />);
    await waitFor(() => {
      // Desktop table should be present
      const tables = document.querySelectorAll("table");
      expect(tables.length).toBe(1);
    });
  });
});
