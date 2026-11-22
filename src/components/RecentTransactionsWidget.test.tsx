import "@testing-library/jest-dom";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Transaction } from "@/lib/client";

import { RecentTransactionsWidget } from "./RecentTransactionsWidget";

const mockTxs: Transaction[] = [
  {
    hash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    ledger: 100,
    createdAt: "2026-07-26T10:30:00Z",
    successful: true,
    operationCount: 1,
    feePaid: "100",
    type: "Payment",
  },
  {
    hash: "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
    ledger: 99,
    createdAt: "2026-07-25T15:45:00Z",
    successful: false,
    operationCount: 2,
    feePaid: "200",
    type: "InvokeHostFunction",
  },
];

describe("RecentTransactionsWidget (Issue #1143)", () => {
  it("renders the widget title and transaction items with amount, date, and status", () => {
    render(<RecentTransactionsWidget transactions={mockTxs} />);

    expect(screen.getByText("Recent Transactions")).toBeInTheDocument();

    // Check row 1
    expect(screen.getByText("Payment")).toBeInTheDocument();
    expect(screen.getByText("Success")).toBeInTheDocument();
    expect(screen.getAllByTestId("recent-tx-amount")[0]).toHaveTextContent(/XLM/);
    expect(screen.getAllByTestId("recent-tx-date")[0]).toHaveTextContent(/Jul/);

    // Check row 2
    expect(screen.getByText("InvokeHostFunction")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("limits the number of displayed transactions to 5 by default", () => {
    const manyTxs: Transaction[] = Array.from({ length: 10 }, (_, i) => ({
      hash: `tx-hash-${i}`,
      ledger: 100 - i,
      createdAt: "2026-07-26T10:00:00Z",
      successful: true,
      operationCount: 1,
      feePaid: "100",
      type: `Payment ${i}`,
    }));

    render(<RecentTransactionsWidget transactions={manyTxs} />);

    const amounts = screen.getAllByTestId("recent-tx-amount");
    expect(amounts).toHaveLength(5);
  });

  it("calls onViewFullHistory when the button or a row is clicked", () => {
    const onViewFullHistory = vi.fn();
    render(
      <RecentTransactionsWidget
        transactions={mockTxs}
        onViewFullHistory={onViewFullHistory}
      />,
    );

    const viewAllBtn = screen.getByTestId("view-full-history-button");
    fireEvent.click(viewAllBtn);
    expect(onViewFullHistory).toHaveBeenCalledTimes(1);

    const row = screen.getByTestId(`recent-tx-row-${mockTxs[0].hash}`);
    fireEvent.click(row);
    expect(onViewFullHistory).toHaveBeenCalledTimes(2);
  });

  it("displays empty state when transactions list is empty", () => {
    render(<RecentTransactionsWidget transactions={[]} />);
    expect(screen.getByTestId("no-recent-txs")).toHaveTextContent(
      "No recent transactions found",
    );
  });
});
