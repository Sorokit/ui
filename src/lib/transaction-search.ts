/**
 * Transaction search (#1159).
 *
 * Full-text matching across the fields a user is likely to remember about a
 * transaction: recipient, amount, memo, hash, status, type and date. Pure
 * functions so the same logic can back any list of transactions.
 */

import type { Transaction } from "./client";

export interface TransactionSearchCriteria {
  /** Free text. Whitespace-separated terms must ALL match (AND). */
  query?: string;
  /** Inclusive lower bound, `YYYY-MM-DD`. */
  dateFrom?: string;
  /** Inclusive upper bound, `YYYY-MM-DD`. */
  dateTo?: string;
}

/** Split a query into lowercase search terms. */
export function tokenizeQuery(query: string | undefined): string[] {
  return (query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
}

/** Everything searchable about a transaction, joined and lowercased. */
export function searchableText(tx: Transaction): string {
  const created = new Date(tx.createdAt);
  const validDate = !Number.isNaN(created.getTime());
  const parts: Array<string | number | undefined> = [
    tx.hash,
    tx.memo,
    tx.destination,
    tx.source,
    tx.amount,
    tx.asset,
    tx.contractId,
    tx.operationType,
    tx.type,
    tx.ledger,
    // Status words, so "failed" / "success" work as search terms.
    tx.successful ? "success successful" : "failed failure",
    tx.operationCount > 1 ? `${tx.operationCount} ops multi-op` : undefined,
    // ISO date (2024-02-15) and a readable form (feb 15 2024).
    validDate ? created.toISOString().slice(0, 10) : undefined,
    validDate
      ? created.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : undefined,
  ];
  return parts
    .filter((p) => p !== undefined && p !== null && p !== "")
    .join(" ")
    .toLowerCase();
}

/** True when `tx` satisfies the query terms and the date range. */
export function matchesTransactionSearch(
  tx: Transaction,
  criteria: TransactionSearchCriteria,
): boolean {
  const terms = tokenizeQuery(criteria.query);
  if (terms.length) {
    const haystack = searchableText(tx);
    if (!terms.every((t) => haystack.includes(t))) return false;
  }

  if (criteria.dateFrom || criteria.dateTo) {
    const created = new Date(tx.createdAt);
    if (Number.isNaN(created.getTime())) return false;
    if (criteria.dateFrom && created < new Date(`${criteria.dateFrom}T00:00:00`)) {
      return false;
    }
    if (criteria.dateTo && created > new Date(`${criteria.dateTo}T23:59:59`)) {
      return false;
    }
  }
  return true;
}

export function searchTransactions(
  txs: Transaction[],
  criteria: TransactionSearchCriteria,
): Transaction[] {
  return txs.filter((tx) => matchesTransactionSearch(tx, criteria));
}
