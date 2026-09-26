import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { RebalanceRecord } from "@/lib/rebalancer";
import { formatPct } from "@/lib/rebalancer";

import { RebalancerHistory } from "./RebalancerHistory";

const RECORD: RebalanceRecord = {
  id: "r1",
  executedAt: "2026-01-15T12:30:00Z",
  swaps: [],
  before: { XLM: 60, USDC: 40 },
  after: { XLM: 50, USDC: 50 },
  totalFeeUsd: 1.23,
  successful: true,
  txHashes: ["abc123"],
};

// formatDate emits a fixed en-US / UTC string so it is stable across machines.
const EXPECTED_DATE = new Date(RECORD.executedAt).toLocaleString("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

describe("RebalancerHistory", () => {
  it("renders a guided empty state when there are no records", () => {
    render(<RebalancerHistory records={[]} />);
    expect(screen.getByText("No rebalance history yet")).toBeInTheDocument();
    expect(screen.getByText(/Run a rebalance/i)).toBeInTheDocument();
  });

  it("renders a deterministic, timezone-stable timestamp", () => {
    render(<RebalancerHistory records={[RECORD]} />);
    expect(screen.getByText(EXPECTED_DATE)).toBeInTheDocument();
  });

  it("shows the Completed badge and total fee for a successful rebalance", () => {
    render(<RebalancerHistory records={[RECORD]} />);
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("$1.23")).toBeInTheDocument();
  });

  it("shows the Partial badge for an unsuccessful rebalance", () => {
    render(
      <RebalancerHistory
        records={[{ ...RECORD, id: "r2", successful: false }]}
      />,
    );
    expect(screen.getByText("Partial")).toBeInTheDocument();
  });

  it("renders the top before/after allocations", () => {
    render(<RebalancerHistory records={[RECORD]} />);
    expect(screen.getAllByText(formatPct(60, 1)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(formatPct(50, 1)).length).toBeGreaterThan(0);
  });
});
