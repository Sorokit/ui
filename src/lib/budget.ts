import type { Transaction } from "./client";

export interface BudgetCategory {
  type: string;
  amount: number;
  count: number;
}

export interface BudgetBreakdown {
  total: number;
  categories: BudgetCategory[];
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
