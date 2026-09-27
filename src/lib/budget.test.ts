import { describe, expect, it } from "vitest";

import { computeBudgetBreakdown } from "./budget";
import type { Transaction } from "./client";

const txs: Transaction[] = [
  {
    hash: "tx-1",
    ledger: 1,
    createdAt: "2026-01-01T00:00:00Z",
    successful: true,
    operationCount: 1,
    feePaid: "100",
    type: "Payment",
  },
  {
    hash: "tx-2",
    ledger: 2,
    createdAt: "2026-01-02T00:00:00Z",
    successful: true,
    operationCount: 1,
    feePaid: "75",
    type: "Payment",
  },
  {
    hash: "tx-3",
    ledger: 3,
    createdAt: "2026-01-03T00:00:00Z",
    successful: true,
    operationCount: 1,
    feePaid: "50",
    type: "Swap",
  },
];

describe("computeBudgetBreakdown", () => {
  it("returns an empty breakdown for an empty transaction list", () => {
    expect(computeBudgetBreakdown([])).toEqual({
      total: 0,
      categories: [],
    });
  });

  it("groups transaction amounts by type", () => {
    expect(computeBudgetBreakdown(txs)).toMatchObject({
      total: 225,
      categories: [
        { type: "Payment", amount: 175, count: 2 },
        { type: "Swap", amount: 50, count: 1 },
      ],
    });
  });

  it("adds amounts across all transactions for the total", () => {
    const breakdown = computeBudgetBreakdown(txs);
    expect(breakdown.total).toBe(225);
    expect(breakdown.categories.reduce((sum, item) => sum + item.amount, 0)).toBe(
      225,
    );
  });
});
