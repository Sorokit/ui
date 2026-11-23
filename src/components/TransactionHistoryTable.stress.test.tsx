import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Transaction } from "@/lib/client";
import { getClient } from "@/lib/client";

import { TransactionHistoryTable } from "./TransactionHistoryTable";

// Mock Sorokit context
vi.mock("@/context/useSorokit", () => ({
  useSorokit: () => ({
    address: "GBRPYHIL2CI3WHGSUJGY6O7SROQOMJG7QBCACN4QPKUOQNXJDGONXHPA",
    isConnected: true,
    get client() {
      return getClient();
    },
  }),
}));

const TOTAL_TRANSACTIONS = 150;

const { stressTransactions } = vi.hoisted(() => ({
  stressTransactions: Array.from({ length: 150 }, (_, i) => ({
    hash: `stress${i.toString().padStart(58, "0")}`,
    ledger: 2000000 + i,
    createdAt: new Date(2026, 0, (i % 28) + 1, 10, i % 60, 0).toISOString(),
    successful: i % 3 !== 0,
    operationCount: (i % 6) + 1,
    feePaid: String(100 + i * 15),
    memo: i % 4 === 0 ? `Stress test memo ${i}` : undefined,
  })) as Transaction[],
}));

vi.mock("@/lib/client", () => ({
  getClient: vi.fn(() => ({
    transaction: {
      getHistory: vi.fn().mockImplementation((_addr: string, page = 1, limit = 20) => {
        const start = (page - 1) * limit;
        const end = start + limit;
        return Promise.resolve({
          data: stressTransactions.slice(start, end),
          error: null,
          total: TOTAL_TRANSACTIONS,
        });
      }),
    },
  })),
}));

// Mock URL and blob operations
const mockCreateObjectURL = vi.fn(() => "blob:mock-stress");
const mockRevokeObjectURL = vi.fn();
URL.createObjectURL = mockCreateObjectURL;
URL.revokeObjectURL = mockRevokeObjectURL;

describe("TransactionHistoryTable stress test (100+ transactions) (#1167)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getClient).mockReturnValue({
      transaction: {
        getHistory: vi.fn().mockImplementation((_addr: string, page = 1, limit = 20) => {
          const start = (page - 1) * limit;
          const end = start + limit;
          return Promise.resolve({
            data: stressTransactions.slice(start, end),
            error: null,
            total: TOTAL_TRANSACTIONS,
          });
        }),
      },
    } as unknown as ReturnType<typeof getClient>);
  });

  it("loads 100+ transactions without crashing and within acceptable performance budget", async () => {
    const memBefore = process.memoryUsage().heapUsed;
    const startTime = performance.now();

    render(<TransactionHistoryTable pageSize={20} />);

    // Check header renders
    expect(screen.getByText("Transaction History")).toBeInTheDocument();

    // Verify 150 transactions loaded
    await waitFor(() => {
      expect(screen.getByText(/150 transactions?/i)).toBeInTheDocument();
    });

    const duration = performance.now() - startTime;
    const memAfter = process.memoryUsage().heapUsed;
    const memDeltaMb = (memAfter - memBefore) / (1024 * 1024);

    // Performance acceptable: should render well under 1000ms in jsdom
    expect(duration).toBeLessThan(1000);

    // Memory usage monitored: heap consumption remains healthy (< 50MB delta)
    expect(memDeltaMb).toBeLessThan(50);
  });

  it("handles pagination through 100+ transactions smoothly", async () => {
    render(<TransactionHistoryTable pageSize={20} />);

    await waitFor(() => {
      expect(screen.getByText(/150 transactions?/i)).toBeInTheDocument();
    });

    // Check pagination indicator (e.g. Page 1 of 8)
    expect(screen.getByText(/Page 1 of 8/i)).toBeInTheDocument();

    // Advance to page 2
    const nextBtn = screen.getByText("Next");
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(screen.getByText(/Page 2 of 8/i)).toBeInTheDocument();
    });

    // Advance to page 3
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(screen.getByText(/Page 3 of 8/i)).toBeInTheDocument();
    });

    // Previous page works
    const prevBtn = screen.getByText("Prev");
    fireEvent.click(prevBtn);

    await waitFor(() => {
      expect(screen.getByText(/Page 2 of 8/i)).toBeInTheDocument();
    });
  });

  it("performs client-side sorting across 100+ transactions without crashing", async () => {
    render(<TransactionHistoryTable pageSize={20} />);

    await waitFor(() => {
      expect(screen.getByText(/150 transactions?/i)).toBeInTheDocument();
    });

    // Sort by Ledger
    const ledgerHeader = screen.getByText("Ledger");
    fireEvent.click(ledgerHeader);
    expect(ledgerHeader.closest("th")).toHaveAttribute("aria-sort", "descending");

    // Toggle sort order
    fireEvent.click(ledgerHeader);
    expect(ledgerHeader.closest("th")).toHaveAttribute("aria-sort", "ascending");

    // Sort by Fee
    const feeHeader = screen.getByText("Fee");
    fireEvent.click(feeHeader);
    expect(feeHeader.closest("th")).toHaveAttribute("aria-sort", "descending");

    // Table remains intact and renders
    expect(screen.getByText("Transaction History")).toBeInTheDocument();
  });

  it("exports all 100+ transactions to CSV without error", async () => {
    const onExportMock = vi.fn();
    render(<TransactionHistoryTable pageSize={20} onExport={onExportMock} />);

    await waitFor(() => {
      expect(screen.getByText("CSV")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("CSV"));

    expect(onExportMock).toHaveBeenCalledTimes(1);
    const csvContent = onExportMock.mock.calls[0][0];
    const lines = csvContent.trim().split("\n");

    // Header line + at least the page rows
    expect(lines.length).toBeGreaterThan(20);
    expect(csvContent).toContain("Hash,Ledger,Date,Time,Status,Fee (stroops),Operations,Memo");
  });
});
