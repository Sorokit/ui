import type { Transaction } from "./client";

export interface BudgetCategory {
  type: string;
  amount: number;
  count: number;
  limit?: number;
  exceeded?: boolean;
}

export interface BudgetBreakdown {
  total: number;
  categories: BudgetCategory[];
}

export interface BudgetTransaction extends Transaction {
  /** Optional payment amount string (falls back to feePaid when omitted) */
  amount?: string;
  /** Optional currency/asset code for multi-currency conversion (default "XLM") */
  currency?: string;
}

export type CategoryRules = Record<string, string[]>;

export const DEFAULT_CATEGORY_RULES: CategoryRules = {
  Groceries: ["grocery", "groceries", "supermarket", "market", "food"],
  Utilities: ["utility", "utilities", "electric", "water", "internet", "power"],
  Rent: ["rent", "housing", "lease", "apartment"],
  Swap: ["swap", "dex", "exchange", "trade"],
  Transfer: ["transfer", "send", "payment", "remittance"],
};

/**
 * Return exact UTC start-of-month and end-of-month millisecond timestamps
 * for a given year and 1-indexed month (1 = January, 12 = December),
 * handling 28/29/30/31-day months and leap years accurately.
 */
export function getUtcMonthBounds(
  year: number,
  month: number,
): { startMs: number; endMs: number } {
  const startMs = Date.UTC(year, month - 1, 1, 0, 0, 0, 0);
  const endMs = Date.UTC(year, month, 0, 23, 59, 59, 999);
  return { startMs, endMs };
}

/**
 * Strip leading/trailing hashtags, emojis, and punctuation from a memo string
 * and normalize whitespace/case for reliable keyword category matching.
 */
export function normalizeMemoForCategory(memo?: string | null): string {
  if (!memo) return "";
  return memo
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resolve a transaction's budget category by matching its normalized memo
 * against keyword rules first, falling back to `tx.type ?? tx.operationType ?? "Unknown"`.
 */
export function matchTransactionCategory(
  tx: Pick<Transaction, "memo" | "type" | "operationType">,
  rules: CategoryRules = DEFAULT_CATEGORY_RULES,
): string {
  const normalizedMemo = normalizeMemoForCategory(tx.memo);
  if (normalizedMemo) {
    const tokens = new Set(normalizedMemo.split(" "));
    for (const [category, keywords] of Object.entries(rules)) {
      for (const kw of keywords) {
        const cleanKw = normalizeMemoForCategory(kw);
        if (!cleanKw) continue;
        if (tokens.has(cleanKw) || normalizedMemo.includes(cleanKw)) {
          return category;
        }
      }
    }
  }
  return tx.type ?? tx.operationType ?? "Unknown";
}

export interface MonthlySpendingOptions {
  /** 4-digit UTC year (e.g. 2026). If omitted along with month, all dates are included. */
  year?: number;
  /** 1-indexed UTC month (1–12). */
  month?: number;
  /** Custom keyword rules mapping CategoryName -> keywords */
  categoryRules?: CategoryRules;
  /** Conversion rates mapping currency code -> base currency multiplier (default 1) */
  conversionRates?: Record<string, number>;
  /** Optional spending limits per category in base currency */
  categoryLimits?: Record<string, number>;
}

/**
 * Calculate monthly spending across UTC month boundaries with memo normalization
 * and multi-currency conversion support.
 */
export function calculateMonthlySpending(
  transactions: BudgetTransaction[],
  options: MonthlySpendingOptions = {},
): BudgetBreakdown {
  const {
    year,
    month,
    categoryRules = DEFAULT_CATEGORY_RULES,
    conversionRates = {},
    categoryLimits = {},
  } = options;

  const bounds =
    year !== undefined && month !== undefined
      ? getUtcMonthBounds(year, month)
      : null;

  const totals = new Map<string, { amount: number; count: number }>();

  for (const tx of transactions) {
    if (bounds) {
      const ts = Date.parse(tx.createdAt);
      if (Number.isNaN(ts) || ts < bounds.startMs || ts > bounds.endMs) {
        continue;
      }
    }

    const category = tx.memo
      ? matchTransactionCategory(tx, categoryRules)
      : (tx.type ?? tx.operationType ?? "Unknown");

    const rawAmount = Number.parseFloat(tx.amount ?? tx.feePaid ?? "0") || 0;
    const rate = tx.currency ? (conversionRates[tx.currency] ?? 1) : 1;
    const convertedAmount = rawAmount * rate;

    const current = totals.get(category) ?? { amount: 0, count: 0 };
    current.amount = Number((current.amount + convertedAmount).toFixed(8));
    current.count += 1;
    totals.set(category, current);
  }

  const categories: BudgetCategory[] = [...totals.entries()]
    .map(([type, values]) => {
      const limit = categoryLimits[type];
      return {
        type,
        amount: values.amount,
        count: values.count,
        ...(limit !== undefined
          ? { limit, exceeded: values.amount > limit }
          : {}),
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const total = Number(
    categories.reduce((sum, item) => sum + item.amount, 0).toFixed(8),
  );

  return {
    total,
    categories,
  };
}

export function computeBudgetBreakdown(
  transactions: Transaction[],
): BudgetBreakdown {
  const totals = new Map<string, { amount: number; count: number }>();

  for (const tx of transactions) {
    const type = tx.type ?? tx.operationType ?? "Unknown";
    const amount = Number.parseFloat(tx.feePaid ?? "0") || 0;

    const current = totals.get(type) ?? { amount: 0, count: 0 };
    current.amount += amount;
    current.count += 1;
    totals.set(type, current);
  }

  return {
    total: [...totals.values()].reduce((sum, item) => sum + item.amount, 0),
    categories: [...totals.entries()]
      .map(([type, values]) => ({
        type,
        amount: values.amount,
        count: values.count,
      }))
      .sort((a, b) => b.amount - a.amount),
  };
}
