import { describe, expect, it } from "vitest";

import {
  calculateMonthlySpending,
  type CategoryRule,
  computeBudgetBreakdown,
  monthKeyUtc,
  normalizeMemoForMatching,
} from "./budget";
import { computeBudgetBreakdown, convertXlmToUsd, formatUtcDate } from "./budget";
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

// ─── monthKeyUtc (issue #971) ───────────────────────────────────────────────

describe("monthKeyUtc", () => {
  it("buckets an ordinary mid-month timestamp into its own UTC month", () => {
    expect(monthKeyUtc("2026-01-15T12:00:00Z")).toBe("2026-01");
  });

  it("buckets the first instant of a month into that month, not the previous one", () => {
    expect(monthKeyUtc("2026-02-01T00:00:00Z")).toBe("2026-02");
  });

  it("buckets the last instant of a month into that month, not the next one", () => {
    expect(monthKeyUtc("2026-01-31T23:59:59.999Z")).toBe("2026-01");
  });

  it("handles the February-to-March rollover across a 28-day month", () => {
    expect(monthKeyUtc("2026-02-28T23:59:59Z")).toBe("2026-02");
    expect(monthKeyUtc("2026-03-01T00:00:00Z")).toBe("2026-03");
  });

  it("handles a leap-year February-to-March rollover across a 29-day month", () => {
    // 2028 is a leap year.
    expect(monthKeyUtc("2028-02-29T23:59:59Z")).toBe("2028-02");
    expect(monthKeyUtc("2028-03-01T00:00:00Z")).toBe("2028-03");
  });

  it("handles the December-to-January year rollover", () => {
    expect(monthKeyUtc("2026-12-31T23:59:59Z")).toBe("2026-12");
    expect(monthKeyUtc("2027-01-01T00:00:00Z")).toBe("2027-01");
  });

  it("buckets by UTC even for a timestamp whose local-timezone date would differ", () => {
    // 2026-01-31T23:30:00-01:00 is 2026-02-01T00:30:00Z: already February
    // in UTC, regardless of what date it reads as in a UTC-1 timezone.
    expect(monthKeyUtc("2026-01-31T23:30:00-01:00")).toBe("2026-02");
    // And the mirror case: 2026-02-01T00:30:00+01:00 is still January in UTC.
    expect(monthKeyUtc("2026-02-01T00:30:00+01:00")).toBe("2026-01");
  });
});

// ─── normalizeMemoForMatching (issue #971) ─────────────────────────────────

describe("normalizeMemoForMatching", () => {
  it("lowercases the memo", () => {
    expect(normalizeMemoForMatching("LUNCH")).toBe("lunch");
  });

  it("strips a leading emoji and hashtag", () => {
    expect(normalizeMemoForMatching("🍔 Lunch #food")).toBe("lunch food");
  });

  it("strips punctuation adjacent to words", () => {
    expect(normalizeMemoForMatching("Lunch!")).toBe("lunch");
    expect(normalizeMemoForMatching("coffee, tea")).toBe("coffee tea");
  });

  it("collapses repeated whitespace left behind by stripped symbols", () => {
    expect(normalizeMemoForMatching("🍔🍟 lunch")).toBe("lunch");
  });

  it("leaves plain alphanumeric text unchanged apart from case", () => {
    expect(normalizeMemoForMatching("Rent payment 2026")).toBe("rent payment 2026");
  });

  it("returns an empty string for a memo that is entirely symbols", () => {
    expect(normalizeMemoForMatching("🍔🍟#!")).toBe("");
  });
});

// ─── calculateMonthlySpending (issue #971) ─────────────────────────────────

describe("calculateMonthlySpending", () => {
  const categories: CategoryRule[] = [
    { name: "Food", keywords: ["lunch", "dinner", "grocery"], limit: 50 },
    { name: "Subscriptions", keywords: ["subscription", "netflix"] },
  ];

  function tx(overrides: Partial<Transaction>): Transaction {
    return {
      hash: "tx",
      ledger: 1,
      createdAt: "2026-01-15T00:00:00Z",
      successful: true,
      operationCount: 1,
      feePaid: "1000000", // 0.1 XLM
      ...overrides,
    };
  }

  it("only includes transactions from the requested UTC month", () => {
    const result = calculateMonthlySpending(
      [
        tx({ hash: "jan", createdAt: "2026-01-15T00:00:00Z", memo: "lunch" }),
        tx({ hash: "feb", createdAt: "2026-02-01T00:00:00Z", memo: "lunch" }),
      ],
      "2026-01",
      categories,
    );
    expect(result.categories).toEqual([{ category: "Food", amount: 0.1, count: 1, limit: 50 }]);
  });

  it("excludes a failed transaction from the month's totals", () => {
    const result = calculateMonthlySpending(
      [tx({ memo: "lunch", successful: false })],
      "2026-01",
      categories,
    );
    expect(result.total).toBe(0);
    expect(result.categories).toEqual([]);
  });

  it("matches a category by keyword even through memo punctuation and emoji", () => {
    const result = calculateMonthlySpending(
      [tx({ memo: "🍔 Lunch! #food" })],
      "2026-01",
      categories,
    );
    expect(result.categories).toEqual([{ category: "Food", amount: 0.1, count: 1, limit: 50 }]);
  });

  it("falls back to Uncategorized when no category keyword matches", () => {
    const result = calculateMonthlySpending(
      [tx({ memo: "random memo" })],
      "2026-01",
      categories,
    );
    expect(result.categories).toEqual([{ category: "Uncategorized", amount: 0.1, count: 1, limit: undefined }]);
  });

  it("falls back to Uncategorized when there is no memo at all", () => {
    const result = calculateMonthlySpending([tx({ memo: undefined })], "2026-01", categories);
    expect(result.categories[0].category).toBe("Uncategorized");
  });

  it("sums multiple transactions into the same category", () => {
    const result = calculateMonthlySpending(
      [
        tx({ hash: "a", memo: "lunch", feePaid: "1000000" }), // 0.1 XLM
        tx({ hash: "b", memo: "dinner", feePaid: "2000000" }), // 0.2 XLM
      ],
      "2026-01",
      categories,
    );
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].category).toBe("Food");
    expect(result.categories[0].count).toBe(2);
    expect(result.categories[0].limit).toBe(50);
    expect(result.categories[0].amount).toBeCloseTo(0.3);
    expect(result.total).toBeCloseTo(0.3);
  });

  it("sorts categories by amount descending", () => {
    const result = calculateMonthlySpending(
      [
        tx({ hash: "a", memo: "netflix subscription", feePaid: "500000" }), // 0.05
        tx({ hash: "b", memo: "lunch", feePaid: "3000000" }), // 0.3
      ],
      "2026-01",
      categories,
    );
    expect(result.categories.map((c) => c.category)).toEqual(["Food", "Subscriptions"]);
  });

  // ── Multi-currency conversion ──────────────────────────────────────────

  it("defaults to treating whole XLM as the output currency when no rate is given", () => {
    const result = calculateMonthlySpending([tx({ memo: "lunch" })], "2026-01", categories);
    // 1,000,000 stroops = 0.1 XLM, no conversion applied.
    expect(result.categories[0].amount).toBeCloseTo(0.1);
  });

  it("converts XLM fees into the output currency using the supplied rate", () => {
    const result = calculateMonthlySpending(
      [tx({ memo: "lunch" })],
      "2026-01",
      categories,
      0.12, // $0.12 per XLM
    );
    // 0.1 XLM * $0.12/XLM = $0.012
    expect(result.categories[0].amount).toBeCloseTo(0.012);
  });

  it("applies the conversion rate uniformly across every category and the total", () => {
    const rate = 0.5;
    const result = calculateMonthlySpending(
      [
        tx({ hash: "a", memo: "lunch", feePaid: "1000000" }), // 0.1 XLM
        tx({ hash: "b", memo: "netflix", feePaid: "4000000" }), // 0.4 XLM
      ],
      "2026-01",
      categories,
      rate,
    );
    expect(result.categories.find((c) => c.category === "Food")!.amount).toBeCloseTo(0.05);
    expect(result.categories.find((c) => c.category === "Subscriptions")!.amount).toBeCloseTo(
      0.2,
    );
    expect(result.total).toBeCloseTo(0.25);
  });

  it("returns an empty breakdown for a month with no matching transactions", () => {
    const result = calculateMonthlySpending(
      [tx({ createdAt: "2026-02-01T00:00:00Z" })],
      "2026-01",
      categories,
    );
    expect(result).toEqual({ month: "2026-01", total: 0, categories: [] });
  });

  it("surfaces each category's configured limit unchanged", () => {
    const result = calculateMonthlySpending([tx({ memo: "lunch" })], "2026-01", categories);
    expect(result.categories[0].limit).toBe(50);
  });

  it("leaves limit undefined for a category rule with none configured", () => {
    const result = calculateMonthlySpending(
      [tx({ memo: "netflix" })],
      "2026-01",
      categories,
    );
    expect(result.categories[0].limit).toBeUndefined();
describe("formatUtcDate", () => {
  it("formats the UTC calendar date, not the local one", () => {
    // Local-time formatting would print Dec 31, 2025 in timezones west of UTC.
    expect(formatUtcDate("2026-01-01T00:00:00Z")).toBe("Jan 1, 2026");
    expect(formatUtcDate("2026-03-15T23:59:59Z")).toBe("Mar 15, 2026");
  });

  it("returns a placeholder for invalid input", () => {
    expect(formatUtcDate("not-a-date")).toBe("—");
  });
});

describe("convertXlmToUsd", () => {
  it("multiplies by the rate and rounds to cents", () => {
    expect(convertXlmToUsd(1000, 0.12)).toBe(120);
    expect(convertXlmToUsd(12.345, 0.12)).toBe(1.48);
  });

  it("returns 0 for invalid or negative input", () => {
    expect(convertXlmToUsd(Number.NaN, 0.12)).toBe(0);
    expect(convertXlmToUsd(-5, 0.12)).toBe(0);
    expect(convertXlmToUsd(10, -1)).toBe(0);
  });
});
