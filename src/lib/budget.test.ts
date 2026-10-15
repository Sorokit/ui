import { describe, expect, it } from "vitest";

import {
  type BudgetTransaction,
  calculateMonthlySpending,
  computeBudgetBreakdown,
  getUtcMonthBounds,
  matchTransactionCategory,
  normalizeMemoForCategory,
} from "./budget";
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

describe("calculateMonthlySpending & month-boundary / memo / multi-currency (#971)", () => {
  it("computes exact UTC month boundaries across 28-day, 29-day leap-year, and 31-day months", () => {
    const febNonLeap = getUtcMonthBounds(2026, 2);
    expect(new Date(febNonLeap.startMs).toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(new Date(febNonLeap.endMs).toISOString()).toBe("2026-02-28T23:59:59.999Z");

    const febLeap = getUtcMonthBounds(2024, 2);
    expect(new Date(febLeap.endMs).toISOString()).toBe("2024-02-29T23:59:59.999Z");

    const boundaryTxs: BudgetTransaction[] = [
      {
        hash: "jan-end",
        ledger: 10,
        createdAt: "2024-01-31T23:59:59.999Z",
        successful: true,
        operationCount: 1,
        feePaid: "10",
        amount: "50",
        type: "Payment",
      },
      {
        hash: "feb-start",
        ledger: 11,
        createdAt: "2024-02-01T00:00:00.000Z",
        successful: true,
        operationCount: 1,
        feePaid: "10",
        amount: "120",
        type: "Payment",
      },
      {
        hash: "feb-leap-end",
        ledger: 12,
        createdAt: "2024-02-29T23:59:59.999Z",
        successful: true,
        operationCount: 1,
        feePaid: "10",
        amount: "80",
        type: "Payment",
      },
      {
        hash: "mar-start",
        ledger: 13,
        createdAt: "2024-03-01T00:00:00.000Z",
        successful: true,
        operationCount: 1,
        feePaid: "10",
        amount: "300",
        type: "Payment",
      },
    ];

    const febSpending = calculateMonthlySpending(boundaryTxs, { year: 2024, month: 2 });
    expect(febSpending.total).toBe(200);
    expect(febSpending.categories).toEqual([{ type: "Payment", amount: 200, count: 2 }]);
  });

  it("normalizes memos with leading hashtags, emojis, and punctuation to match categories", () => {
    expect(normalizeMemoForCategory("🛒 #Groceries!! -- Weekly Market")).toBe(
      "groceries weekly market",
    );
    expect(
      matchTransactionCategory({
        memo: "⚡ #Electric_bill! 💡",
        type: "Payment",
      }),
    ).toBe("Utilities");
    expect(
      matchTransactionCategory({
        memo: "🏠 [Rent: March]",
        type: "Payment",
      }),
    ).toBe("Rent");
  });

  it("applies multi-currency conversion rates and evaluates category limits", () => {
    const multiCurrencyTxs: BudgetTransaction[] = [
      {
        hash: "mc-1",
        ledger: 20,
        createdAt: "2026-03-10T12:00:00Z",
        successful: true,
        operationCount: 1,
        feePaid: "100",
        amount: "500",
        currency: "XLM",
        memo: "🛒 #groceries!",
      },
      {
        hash: "mc-2",
        ledger: 21,
        createdAt: "2026-03-15T12:00:00Z",
        successful: true,
        operationCount: 1,
        feePaid: "100",
        amount: "60",
        currency: "USDC",
        memo: "🥑 Supermarket run",
      },
      {
        hash: "mc-3",
        ledger: 22,
        createdAt: "2026-03-20T12:00:00Z",
        successful: true,
        operationCount: 1,
        feePaid: "100",
        amount: "50",
        currency: "EURC",
        memo: "💡 #internet-bill",
      },
    ];

    const result = calculateMonthlySpending(multiCurrencyTxs, {
      year: 2026,
      month: 3,
      conversionRates: { XLM: 0.1, USDC: 1.0, EURC: 1.1 },
      categoryLimits: { Groceries: 100, Utilities: 100 },
    });

    // Groceries: 500 * 0.1 ($50) + 60 * 1.0 ($60) = $110 (exceeds $100 limit)
    // Utilities: 50 * 1.1 = $55 (under $100 limit)
    expect(result.total).toBeCloseTo(165);
    expect(result.categories).toEqual([
      { type: "Groceries", amount: 110, count: 2, limit: 100, exceeded: true },
      { type: "Utilities", amount: 55, count: 1, limit: 100, exceeded: false },
    ]);
  });
});
