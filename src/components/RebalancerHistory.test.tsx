import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { buildRebalanceRecord, createInitialExecution, formatPct, formatUsd } from "@/lib/rebalancer";

import { RebalancerHistory } from "./RebalancerHistory";

// Helper to create a record easily
function createRecord(id: string, dateStr: string, totalFeeUsd: number) {
  const exec = createInitialExecution(1);
  exec.startedAt = dateStr;
  exec.swapStatuses = ["success"];
  exec.txHashes = ["hash1"];
  
  return buildRebalanceRecord(
    id,
    [
      {
        from: "XLM",
        to: "USDC",
        fromAmount: 10,
        toAmountExpected: 1,
        slippagePct: 0.1,
        feeStroops: 100,
        swapFeePct: 0.3,
        totalCostUsd: 0.05,
      }
    ],
    exec,
    { XLM: 60, USDC: 40 },
    { XLM: 50, USDC: 50 },
    totalFeeUsd
  );
}

describe("RebalancerHistory", () => {
  it("renders empty state when there are no records", () => {
    render(<RebalancerHistory records={[]} />);
    expect(screen.getByText("No rebalance history yet")).toBeInTheDocument();
    expect(screen.getByText(/Run a rebalance/i)).toBeInTheDocument();
  });

  it("renders records in newest-first sort order", () => {
    const olderRecord = createRecord("r1", "2026-01-10T12:00:00Z", 1.0);
    const newerRecord = createRecord("r2", "2026-01-15T12:00:00Z", 2.0);

    render(<RebalancerHistory records={[olderRecord, newerRecord]} />);
    
    const rows = screen.getAllByRole("article");
    expect(rows).toHaveLength(2);

    const firstRowDate = new Date("2026-01-15T12:00:00Z").toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    });
    
    const secondRowDate = new Date("2026-01-10T12:00:00Z").toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    });

    expect(rows[0]).toHaveTextContent(firstRowDate);
    expect(rows[1]).toHaveTextContent(secondRowDate);
  });

  it("displays correct before and after allocations", () => {
    const record = createRecord("r1", "2026-01-15T12:30:00Z", 1.23);
    render(<RebalancerHistory records={[record]} />);

    expect(screen.getAllByText(formatPct(60, 1)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(formatPct(40, 1)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(formatPct(50, 1)).length).toBeGreaterThan(0);
  });

  it("displays correct total fee", () => {
    const record = createRecord("r1", "2026-01-15T12:30:00Z", 1.23);
    render(<RebalancerHistory records={[record]} />);
    expect(screen.getByText(formatUsd(1.23))).toBeInTheDocument();
  });

  it("displays swap count", () => {
    const record = createRecord("r1", "2026-01-15T12:30:00Z", 1.23);
    render(<RebalancerHistory records={[record]} />);
    
    // We can query the number 1 next to Swaps
    // The component structure is: label "Swaps", value "1"
    const row = screen.getByRole("article");
    expect(row).toHaveTextContent("Swaps1");
  });
});
