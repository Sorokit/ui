import type { Transaction } from "./client";
import { STROOPS_PER_XLM } from "./staking";

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

// ─── Monthly spending by category (issue #971) ─────────────────────────────

/**
 * A user-defined spending category matched against a transaction's memo.
 *
 * Matching is keyword-based, not exact: a transaction's normalized memo
 * (see `normalizeMemoForMatching`) matching any one of `keywords` assigns it
 * to this category. The first matching category in the array wins; a
 * transaction matching no category falls into `calculateMonthlySpending`'s
 * `"Uncategorized"` bucket.
 */
export interface CategoryRule {
  /** Display name for the category (e.g. "Groceries", "Subscriptions"). */
  name: string;
  /** Lowercase keywords to match against the normalized memo. */
  keywords: string[];
  /** Optional monthly limit in the output currency, surfaced for the caller
   * to compare against the category's computed `amount`; this module does
   * not enforce it. */
  limit?: number;
}

/** One category's computed spending for a single month. */
export interface MonthlyCategorySpending {
  category: string;
  /** Total spent in the output currency (see `calculateMonthlySpending`'s
   * `outputCurrency` parameter). */
  amount: number;
  count: number;
  /** The `CategoryRule.limit` that applied, if any. */
  limit?: number;
}

/** One calendar month's full spending breakdown. */
export interface MonthlySpending {
  /** The month, as `YYYY-MM` in UTC (matches the UTC bucketing this module
   * uses throughout, so a caller never has to reconcile a different
   * timezone's idea of which month a transaction fell in). */
  month: string;
  total: number;
  categories: MonthlyCategorySpending[];
}

const UNCATEGORIZED = "Uncategorized";

/**
 * The UTC calendar month a timestamp falls in, as `YYYY-MM`.
 *
 * Deliberately UTC rather than the host's local timezone (issue #971): a
 * transaction timestamped at 2026-01-31T23:30:00 local time in a UTC+1
 * timezone is already 2026-02-01 in UTC, and bucketing by local time (e.g.
 * via `Date`'s plain, timezone-sensitive `getFullYear`/`getMonth`) would put
 * the same transaction in a different month depending on which machine, or
 * which viewer's browser, ran the calculation -- corrupting a total near a
 * month boundary for anyone not in the timezone the data happened to be
 * computed in. Every date operation in this module goes through the UTC
 * (`getUTC*`) accessors instead, with no local-timezone-sensitive call
 * anywhere in it.
 */
export function monthKeyUtc(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1; // getUTCMonth() is 0-indexed.
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Normalizes a transaction memo for category-keyword matching: lowercased,
 * with punctuation, hashtags, and non-letter/digit symbols (emoji in
 * particular) stripped out, whitespace collapsed to single spaces.
 *
 * A memo like `"🍔 Lunch! #food"`, matched verbatim-lowercased against a
 * keyword like `"lunch"`, fails: `"🍔 lunch! #food"` does not contain the
 * substring `"lunch"` surrounded the way a keyword match expects, since
 * neither the emoji nor the `#`/`!` punctuation is part of any real keyword
 * (issue #971). This strips anything that is not a letter, digit, or
 * internal whitespace, rather than only handling the specific hashtag/emoji
 * cases named in the issue: any other punctuation or symbol a memo might
 * contain is normalized the same way, for the same reason.
 */
export function normalizeMemoForMatching(memo: string): string {
  return memo
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The first `CategoryRule` whose keyword matches `memo`, or `null`. */
function matchCategory(memo: string | undefined, categories: CategoryRule[]): CategoryRule | null {
  if (!memo) return null;
  const normalized = normalizeMemoForMatching(memo);
  if (normalized === "") return null;
  return (
    categories.find((category) =>
      category.keywords.some((keyword) => normalized.includes(keyword.toLowerCase())),
    ) ?? null
  );
}

/**
 * Computes one month's total spending, split by `categories`.
 *
 * Only transactions whose UTC month (`monthKeyUtc`) matches `month` are
 * included, and only successful ones: a failed transaction's fee is
 * typically still charged on Stellar, but counting a failed payment toward
 * a spending category it never achieved would overstate what the category
 * actually bought.
 *
 * `feePaid` is always denominated in stroops, the network's native asset:
 * a Stellar transaction's fee is never paid in any other currency,
 * regardless of which asset a Payment operation inside it moves. Every
 * amount this function returns is in `outputCurrency`, converted from
 * stroops via `xlmToOutputCurrencyRate` once, up front, rather than per
 * transaction; a category's `limit`, set by the caller in `outputCurrency`,
 * can then be compared directly against its computed `amount` with no
 * further conversion.
 *
 * @param transactions - Every candidate transaction; filtered internally to
 *   `month` and `successful`.
 * @param month - The UTC calendar month to compute, as `YYYY-MM`.
 * @param categories - Keyword rules to assign each transaction's memo to a
 *   category; a transaction matching none falls into `"Uncategorized"`.
 * @param xlmToOutputCurrencyRate - Units of `outputCurrency` per whole XLM
 *   (e.g. `0.1` if 1 XLM = $0.10). Defaults to `1`, treating whole XLM as
 *   already being in `outputCurrency`, which is almost certainly not the
 *   intended rate for a real budget view; pass the real XLM price to get
 *   actual currency-converted totals. The default exists so a caller that
 *   only cares about the per-category/month grouping, not the currency
 *   conversion, can omit the argument rather than being forced to supply a
 *   rate just to call this function at all.
 * @param outputCurrency - Informational only; included on nothing in the
 *   return value, since every amount is already expressed in it by the
 *   time this returns. Accepted so a caller's rate and its intent stay
 *   self-documenting at the call site.
 */
export function calculateMonthlySpending(
  transactions: Transaction[],
  month: string,
  categories: CategoryRule[],
  xlmToOutputCurrencyRate = 1,
  outputCurrency = "USD",
): MonthlySpending {
  void outputCurrency; // Informational only; see the doc comment above.

  const categoryTotals = new Map<string, { amount: number; count: number }>();

  for (const tx of transactions) {
    if (!tx.successful) continue;
    if (monthKeyUtc(tx.createdAt) !== month) continue;

    const feeStroops = Number.parseFloat(tx.feePaid ?? "0") || 0;
    const feeXlm = feeStroops / STROOPS_PER_XLM;
    const amount = feeXlm * xlmToOutputCurrencyRate;

    const matched = matchCategory(tx.memo, categories);
    const categoryName = matched?.name ?? UNCATEGORIZED;

    const current = categoryTotals.get(categoryName) ?? { amount: 0, count: 0 };
    current.amount += amount;
    current.count += 1;
    categoryTotals.set(categoryName, current);
  }

  const categoryByName = new Map(categories.map((c) => [c.name, c]));
  const monthlyCategories: MonthlyCategorySpending[] = [...categoryTotals.entries()]
    .map(([name, values]) => ({
      category: name,
      amount: values.amount,
      count: values.count,
      limit: categoryByName.get(name)?.limit,
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    month,
    total: monthlyCategories.reduce((sum, c) => sum + c.amount, 0),
    categories: monthlyCategories,
  };
/**
 * Format an ISO timestamp as a calendar date in UTC ("Jan 1, 2026"). Always
 * UTC so the output never shifts a day for users west of Greenwich.
 */
export function formatUtcDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

/** Convert an XLM amount to USD at `rate` (USD per 1 XLM), rounded to cents. */
export function convertXlmToUsd(xlm: number, rate: number): number {
  if (!Number.isFinite(xlm) || !Number.isFinite(rate) || xlm < 0 || rate < 0) return 0;
  return Math.round(xlm * rate * 100) / 100;
}
