import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  CoinsSwapIcon,
  ContractsIcon,
  Copy01Icon,
  GiftIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { memo, useEffect, useMemo, useRef, useState } from "react";

import { OfflineBadge } from "@/components/OfflineBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useSorokit } from "@/context/useSorokit";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import type { Transaction } from "@/lib/client";
import { getClient } from "@/lib/client";
import { readSnapshot, writeSnapshot } from "@/lib/offline-cache";
import { matchesTransactionSearch } from "@/lib/transaction-search";
import { cn, truncateAddress } from "@/lib/utils";

const PAGE_SIZE = 10;
// Search scans the full history, fetched in larger pages up to a hard cap.
const SEARCH_PAGE_SIZE = 100;
const MAX_SEARCH_PAGES = 10;
const MEMO_TRUNCATE_LENGTH = 20;
const STROOPS_PER_XLM = 10_000_000;
const TREND_DAYS = 7;
const MS_PER_DAY = 86_400_000;

/** Sum `feePaid` (stroops) across transactions, ignoring unparseable values. */
function totalFeeStroops(txs: Transaction[]): number {
  return txs.reduce((sum, tx) => {
    const fee = Number.parseInt(tx.feePaid, 10);
    return Number.isFinite(fee) ? sum + fee : sum;
  }, 0);
}

/** Format stroops as XLM, trimming trailing zeros (1 XLM = 10,000,000 stroops). */
function stroopsToXlm(stroops: number): string {
  return (stroops / STROOPS_PER_XLM).toFixed(7).replace(/\.?0+$/, "");
}

/**
 * Bucket transactions into the last `TREND_DAYS` calendar days, oldest first.
 * Day boundaries use local midnight so buckets line up with the dates shown
 * on each row.
 */
function dailyCounts(txs: Transaction[], now: Date = new Date()): number[] {
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const counts = new Array<number>(TREND_DAYS).fill(0);

  for (const tx of txs) {
    const created = new Date(tx.createdAt);
    if (Number.isNaN(created.getTime())) continue;
    // Compare local midnights so a timestamp later in the same day still
    // counts as "today" rather than landing a day early.
    const startOfCreatedDay = new Date(
      created.getFullYear(),
      created.getMonth(),
      created.getDate(),
    ).getTime();
    const daysAgo = Math.round((startOfToday - startOfCreatedDay) / MS_PER_DAY);
    if (daysAgo >= 0 && daysAgo < TREND_DAYS) {
      counts[TREND_DAYS - 1 - daysAgo] += 1;
    }
  }

  return counts;
}

/** Compact 7-day activity sparkline rendered as height-scaled bars. */
function TrendSparkline({ counts }: { counts: number[] }) {
  const peak = Math.max(...counts);
  const total = counts.reduce((sum, n) => sum + n, 0);

  return (
    <div
      className="flex items-end gap-0.5 h-8"
      role="img"
      aria-label={`Transaction activity for the last ${TREND_DAYS} days: ${total} total`}
    >
      {counts.map((count, i) => (
        <div
          key={i}
          data-trend-bar
          title={`${count} transaction${count === 1 ? "" : "s"}`}
          className={cn(
            "w-1.5 rounded-sm shrink-0",
            count > 0 ? "bg-brand" : "bg-surface-2",
          )}
          style={{
            height: peak > 0 ? `${Math.max((count / peak) * 100, 8)}%` : "8%",
          }}
        />
      ))}
    </div>
  );
}

function truncateMemo(memo: string): string {
  return memo.length > MEMO_TRUNCATE_LENGTH
    ? `${memo.slice(0, MEMO_TRUNCATE_LENGTH)}…`
    : memo;
}

/**
 * Detects a 404 "account not found" response from the client's plain-string
 * error message - what Horizon returns for an account that hasn't been
 * funded (created) on the network yet, as opposed to a real network or
 * server failure. The SorokitClient contract surfaces errors as strings
 * rather than structured HTTP responses, so this follows the same
 * substring-matching convention as `friendlyError()` in lib/utils.ts.
 */
function isUnfundedAccountError(error: string | null): boolean {
  if (!error) return false;
  const normalized = error.toLowerCase();
  return (
    normalized.includes("404") ||
    normalized.includes("not found") ||
    normalized.includes("not funded") ||
    normalized.includes("unfunded")
  );
}

function explorerTxUrl(
  networkName: string | undefined,
  hash: string,
): string | null {
  const segment =
    networkName === "mainnet"
      ? "public"
      : networkName === "testnet"
        ? "testnet"
        : null;
  if (!segment) return null;
  return `https://stellar.expert/explorer/${segment}/tx/${hash}`;
}

export const TxRow = memo(function TxRow({
  tx,
  networkName,
}: {
  tx: Transaction;
  networkName?: string;
}) {
  const date = new Date(tx.createdAt);
  const timeStr = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
  const utcStr = date.toUTCString();

  const explorerUrl = explorerTxUrl(networkName, tx.hash);

  const RowWrapper = explorerUrl ? "a" : "div";
  const wrapperProps = explorerUrl
    ? { href: explorerUrl, target: "_blank", rel: "noopener noreferrer" }
    : {};

  const rowLabel = `Transaction ${truncateAddress(tx.hash, 10, 6)} — ${tx.successful ? "Success" : "Failed"} — Fee: ${tx.feePaid} stroops`;

  const opType = (tx.operationType || tx.type || "").toLowerCase();
  const isContract =
    opType.includes("invoke") ||
    opType.includes("contract") ||
    opType.includes("soroban") ||
    Boolean(tx.contractId);

  const isLpDeposit =
    opType.includes("liquidity_pool_deposit") || opType === "lp_deposit";
  const isLpWithdraw =
    opType.includes("liquidity_pool_withdraw") || opType === "lp_withdraw";
  const isLp =
    isLpDeposit ||
    isLpWithdraw ||
    opType.includes("liquidity_pool") ||
    opType.includes("lp");

  const isClaimable =
    opType.includes("claimable") || opType.includes("claim_claimable");

  let OpIcon = tx.successful ? CheckmarkCircle01Icon : Cancel01Icon;
  let opBadgeText: string | null = null;

  if (isContract) {
    OpIcon = ContractsIcon;
    opBadgeText = "Soroban";
  } else if (isLpDeposit) {
    OpIcon = CoinsSwapIcon;
    opBadgeText = "LP Deposit";
  } else if (isLpWithdraw) {
    OpIcon = CoinsSwapIcon;
    opBadgeText = "LP Withdraw";
  } else if (isLp) {
    OpIcon = CoinsSwapIcon;
    opBadgeText = "Liquidity Pool";
  } else if (isClaimable) {
    OpIcon = GiftIcon;
    opBadgeText = "Claimable";
  }

  return (
    <RowWrapper
      {...(wrapperProps as Record<string, string>)}
      role="article"
      aria-label={
        explorerUrl
          ? `${rowLabel} — view on Stellar Expert (opens in a new tab)`
          : rowLabel
      }
      className="flex items-center justify-between px-5 py-3.5 border-b border-line last:border-0 gap-4 hover:bg-surface-2 transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Status icon: purely decorative, hidden from the accessibility
            tree since the Success/Failed badge below already announces
            the same status as real text (issue #961). */}
        <div
          aria-hidden="true"
          data-testid="status-icon-container"
          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${tx.successful ? "bg-success-dim" : "bg-error-dim"}`}
        >
          <HugeiconsIcon
            icon={OpIcon}
            size={14}
            color="currentColor"
            strokeWidth={1.5}
            className={tx.successful ? "text-green" : "text-red"}
          />
        </div>

        <div className="flex flex-col gap-0.5 min-w-0">
          <span data-txhash className="truncate">
            {truncateAddress(tx.hash, 10, 6)}
          </span>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] text-ink-3 shrink-0">Ledger {tx.ledger}</span>
            {tx.memo && (
              <span
                className="text-[10px] text-ink-3 truncate min-w-0"
                title={tx.memo}
              >
                · {truncateMemo(tx.memo)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <div className="flex items-center gap-2">
          <Badge variant={tx.successful ? "success" : "error"} live>
            {tx.successful ? "Success" : "Failed"}
          </Badge>
          {opBadgeText && (
            <Badge
              variant="primary"
              className="text-[10px] px-1.5 py-0.5"
              data-testid="op-badge"
            >
              {opBadgeText}
            </Badge>
          )}
          {tx.operationCount > 1 && (
            <Badge variant="default" className="text-[10px] px-1.5 py-0.5">
              {tx.operationCount} ops
            </Badge>
          )}
          {/* A real <button> would be invalid HTML nested inside the row's
              own <a> wrapper (when it links to the explorer), so this
              uses role="button" on a <span> instead, with the same click
              and keyboard handling a native button gets for free. */}
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              navigator.clipboard?.writeText(tx.hash)?.catch?.(() => {});
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                navigator.clipboard?.writeText(tx.hash)?.catch?.(() => {});
              }
            }}
            className="p-1 rounded hover:bg-surface-2 text-ink-3 hover:text-ink transition-colors cursor-pointer"
            aria-label={`Copy transaction hash ${truncateAddress(tx.hash, 10, 6)}`}
            title="Copy transaction hash"
          >
            <HugeiconsIcon icon={Copy01Icon} size={12} strokeWidth={1.5} />
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] text-ink-3 cursor-help"
            title={utcStr}
            data-testid="tx-timestamp"
          >
            {dateStr} {timeStr}
          </span>
          <span className="text-[10px] text-ink-3">· {tx.feePaid} stroops</span>
        </div>
      </div>
    </RowWrapper>
  );
});

type StatusFilter = "all" | "success" | "failed";

export interface TransactionHistoryProps {
  startDate?: string;
  endDate?: string;
  /** Render a 7-day transaction-activity sparkline in the card header. */
  showTrend?: boolean;
}

export function TransactionHistory({
  startDate,
  endDate,
  showTrend,
}: TransactionHistoryProps = {}) {
  const { address, isConnected, network, client: contextClient } = useSorokit();
  const client = contextClient ?? getClient();
  const [prevAddress, setPrevAddress] = useState(address);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [multiOpOnly, setMultiOpOnly] = useState(false);
  const [memoQuery, setMemoQuery] = useState("");
  // #1159 - search date range (in addition to the optional startDate/endDate
  // props) and the full history used as the search pool.
  const [searchFrom, setSearchFrom] = useState("");
  const [searchTo, setSearchTo] = useState("");
  const [allTxs, setAllTxs] = useState<Transaction[] | null>(null);
  const [searchingAll, setSearchingAll] = useState(false);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // #1163 - offline mode: true while `txs` came from the local cache.
  const isOnline = useOnlineStatus();
  const [isCached, setIsCached] = useState(false);
  const [cachedAt, setCachedAt] = useState<number | null>(null);

  // Shared fetch counter to guard against stale responses when rapid address
  // or page changes occur (e.g., address change triggering a page-reset cycle).
  // Responses from superseded fetch IDs are discarded regardless of execution order.
  // See docs/async-race-conditions.md for background on async race conditions.
  const fetchIdRef = useRef(0);

  if (prevAddress !== address) {
    setPrevAddress(address);
    setPage(1);
    setTotal(0);
    setTxs([]);
    setIsCached(false);
    setAllTxs(null);
  }

  useEffect(() => {
    if (!address || !client) return;

    const fetchId = ++fetchIdRef.current;
    const timerId = window.setTimeout(() => {
      if (fetchId !== fetchIdRef.current) return;
      setLoading(true);
      client
        .transaction.getHistory(address, page, PAGE_SIZE)
        .then(({ data, error: err, total: t }) => {
          if (fetchId !== fetchIdRef.current) return;
          if (err) {
            // #1163 - fall back to the last-known page instead of an error
            // wall, unless the failure is a real "unfunded account" state.
            const cached = isUnfundedAccountError(err)
              ? null
              : readSnapshot(network?.name, address)?.transactions?.[page];
            if (cached) {
              setTxs(cached.items);
              setTotal(cached.total);
              setIsCached(true);
              setCachedAt(readSnapshot(network?.name, address)?.cachedAt ?? null);
              setError(null);
              return;
            }
            setError(err);
            return;
          }
          const items = data ?? [];
          const nextTotal = Number.isFinite(t) && t > 0 ? t : 0;
          setTxs(items);
          setTotal(nextTotal);
          setError(null);
          setIsCached(false);
          writeSnapshot(network?.name, address, {
            transactions: { [page]: { items, total: nextTotal } },
          });
        })
        .catch((e) => {
          if (fetchId !== fetchIdRef.current) return;
          const snapshot = readSnapshot(network?.name, address);
          const cached = snapshot?.transactions?.[page];
          if (cached) {
            setTxs(cached.items);
            setTotal(cached.total);
            setIsCached(true);
            setCachedAt(snapshot?.cachedAt ?? null);
            setError(null);
          } else {
            setError(e instanceof Error ? e.message : "Failed to load history");
          }
        })
        .finally(() => {
          if (fetchId === fetchIdRef.current) setLoading(false);
        });
    }, 0);

    const activeFetchIdRef = fetchIdRef;
    return () => {
      activeFetchIdRef.current++;
      window.clearTimeout(timerId);
    };
    // `isOnline` is a dependency so history refetches automatically when the
    // connection comes back (#1163).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, client, page, isOnline]);

  const searchActive =
    memoQuery.trim() !== "" || searchFrom !== "" || searchTo !== "";

  // #1159 - a search must cover *all* history, not just the 10 rows on screen.
  // Matching starts instantly against the current page; once the full history
  // has loaded in the background the results widen to include it.
  useEffect(() => {
    if (!searchActive) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAllTxs((prev) => (prev ? null : prev));
      return;
    }
    if (!address || !client || allTxs) return;

    let cancelled = false;
    void (async () => {
      setSearchingAll(true);
      const collected: Transaction[] = [];
      for (let p = 1; p <= MAX_SEARCH_PAGES; p++) {
        const res = await client.transaction.getHistory(
          address,
          p,
          SEARCH_PAGE_SIZE,
        );
        if (cancelled) return;
        if (res.error || !res.data) break;
        collected.push(...res.data);
        if (
          res.data.length < SEARCH_PAGE_SIZE ||
          (res.total > 0 && collected.length >= res.total)
        ) {
          break;
        }
      }
      if (cancelled) return;
      if (collected.length) {
        const seen = new Set<string>();
        setAllTxs(collected.filter((t) => !seen.has(t.hash) && seen.add(t.hash)));
      }
      setSearchingAll(false);
    })().catch(() => {
      if (!cancelled) setSearchingAll(false);
    });

    return () => {
      cancelled = true;
    };
  }, [searchActive, address, client, allTxs]);

  const totalPages = total > 0 ? Math.ceil(total / PAGE_SIZE) : 0;

  function changePage(nextPage: number) {
    setPage(nextPage);
  }

  const filteredTxs = useMemo(() => {
    const pool = searchActive && allTxs ? allTxs : txs;
    return pool.filter((tx) => {
      if (statusFilter === "success" && !tx.successful) return false;
      if (statusFilter === "failed" && tx.successful) return false;
      if (multiOpOnly && tx.operationCount <= 1) return false;
      if (startDate && new Date(tx.createdAt) < new Date(startDate)) return false;
      if (endDate && new Date(tx.createdAt) > new Date(endDate + "T23:59:59"))
        return false;
      if (
        !matchesTransactionSearch(tx, {
          query: memoQuery,
          dateFrom: searchFrom,
          dateTo: searchTo,
        })
      ) {
        return false;
      }
      return true;
    });
  }, [
    allTxs,
    endDate,
    memoQuery,
    multiOpOnly,
    searchActive,
    searchFrom,
    searchTo,
    startDate,
    statusFilter,
    txs,
  ]);
  const searchPaged = searchActive && allTxs !== null;

  const feeTotal = totalFeeStroops(filteredTxs);

  const STATUS_BUTTONS: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "success", label: "Success" },
    { value: "failed", label: "Failed" },
  ];

  return (
    <div className="rounded-xl border border-line bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <div>
          <h3 className="text-[14px] font-semibold text-ink">
            Transaction History
          </h3>
          <p className="text-[12px] text-ink-3 mt-0.5">
            {total > 0 ? `${total} transactions` : "Past transactions"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {showTrend && <TrendSparkline counts={dailyCounts(filteredTxs)} />}
          <OfflineBadge
            isOffline={!isOnline}
            isCached={isCached}
            lastSyncedAt={cachedAt}
          />
          {loading && (
            <span className="w-4 h-4 border border-ink-3 border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 px-5 py-2 border-b border-line">
        {STATUS_BUTTONS.map((btn) => (
          <button
            key={btn.value}
            onClick={() => setStatusFilter(btn.value)}
            className={`text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors ${
              statusFilter === btn.value
                ? "bg-brand-dim text-brand"
                : "text-ink-3 hover:text-ink-2"
            }`}
          >
            {btn.label}
          </button>
        ))}
        <button
          onClick={() => setMultiOpOnly((on) => !on)}
          aria-pressed={multiOpOnly}
          className={cn(
            "text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors ml-auto",
            multiOpOnly
              ? "bg-brand-dim text-brand"
              : "text-ink-3 hover:text-ink-2",
          )}
        >
          Multi-op
        </button>
      </div>
      <div className="px-5 py-2.5 border-b border-line flex flex-col gap-2">
        <Input
          value={memoQuery}
          onChange={(e) => setMemoQuery(e.target.value)}
          placeholder="Search memo, recipient, amount, hash, status…"
          aria-label="Search transactions by memo, recipient, amount, hash or status"
          prefix={
            <HugeiconsIcon
              icon={Search01Icon}
              size={14}
              color="currentColor"
              strokeWidth={1.5}
            />
          }
          clearable
          onClear={() => setMemoQuery("")}
          clearLabel="Clear memo search"
          className="h-8 text-[12px]"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={searchFrom}
            max={searchTo || undefined}
            onChange={(e) => setSearchFrom(e.target.value)}
            aria-label="Search from date"
            className="h-8 text-[12px]"
          />
          <span className="text-[11px] text-ink-3">to</span>
          <Input
            type="date"
            value={searchTo}
            min={searchFrom || undefined}
            onChange={(e) => setSearchTo(e.target.value)}
            aria-label="Search to date"
            className="h-8 text-[12px]"
          />
          {searchActive && (
            <button
              type="button"
              onClick={() => {
                setMemoQuery("");
                setSearchFrom("");
                setSearchTo("");
              }}
              className="ml-auto text-[11px] font-medium text-brand hover:underline"
            >
              Clear search
            </button>
          )}
        </div>
        {searchActive && (
          <p
            role="status"
            aria-live="polite"
            data-testid="search-result-count"
            className="text-[11px] text-ink-3"
          >
            {filteredTxs.length} result{filteredTxs.length === 1 ? "" : "s"}
            {searchingAll ? " · searching all history…" : ""}
          </p>
        )}
      </div>

      {!isConnected ? (
        <p className="text-[13px] text-ink-3 text-center py-10">
          Connect your wallet to view history
        </p>
      ) : error && isUnfundedAccountError(error) ? (
        <div className="flex flex-col items-center px-5 py-10 text-center">
          <div
            aria-hidden="true"
            className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-ink-3"
          >
            <HugeiconsIcon
              icon={GiftIcon}
              size={18}
              color="currentColor"
              strokeWidth={1.5}
            />
          </div>
          <p className="text-[13px] font-medium text-ink">
            Unfunded account - no transactions yet
          </p>
          <p className="text-[12px] text-ink-3 mt-1 max-w-[280px]">
            This account hasn't been created on the network yet. Fund it with
            at least the minimum reserve to start transacting.
          </p>
          {network?.name === "testnet" && (
            <a
              href="https://friendbot.stellar.org"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 text-[12px] font-medium text-brand hover:underline"
            >
              Fund with Friendbot →
            </a>
          )}
        </div>
      ) : error ? (
        <p className="text-[13px] text-red text-center py-10">{error}</p>
      ) : loading && txs.length === 0 ? (
        <div className="px-5 py-4 flex flex-col gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-surface-2 animate-pulse shrink-0" />
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="h-3 w-32 rounded bg-surface-2 animate-pulse" />
                <div className="h-2.5 w-20 rounded bg-surface-2 animate-pulse" />
              </div>
              <div className="h-5 w-14 rounded-full bg-surface-2 animate-pulse" />
            </div>
          ))}
        </div>
      ) : txs.length === 0 ? (
        <div className="flex flex-col items-center px-5 py-10 text-center">
          <div
            aria-hidden="true"
            className="mb-3 flex h-12 w-12 items-center justify-center gap-0.5 rounded-full bg-surface-2 text-ink-3"
          >
            <HugeiconsIcon
              icon={ArrowLeft01Icon}
              size={16}
              color="currentColor"
              strokeWidth={1.5}
            />
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              size={16}
              color="currentColor"
              strokeWidth={1.5}
            />
          </div>
          <p className="text-[13px] font-medium text-ink">
            No transactions yet
          </p>
          {network?.name === "testnet" && (
            <a
              href="https://friendbot.stellar.org"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 text-[12px] font-medium text-brand hover:underline"
            >
              Fund with Friendbot →
            </a>
          )}
        </div>
      ) : (
        <>
          <div>
            {filteredTxs.map((tx) => (
              <TxRow key={tx.hash} tx={tx} networkName={network?.name} />
            ))}
            {searchActive && filteredTxs.length === 0 && !searchingAll && (
              <p className="text-[13px] text-ink-3 text-center py-8">
                No transactions match your search
              </p>
            )}
          </div>
          {filteredTxs.length > 0 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-line">
              <span className="text-[11px] text-ink-3">
                {filteredTxs.length} shown
              </span>
              <span
                data-fee-total
                className="text-[11px] text-ink-2 tabular-nums"
              >
                Total fees: {feeTotal.toLocaleString()} stroops (≈{" "}
                {stroopsToXlm(feeTotal)} XLM)
              </span>
            </div>
          )}
          {totalPages > 1 && !searchPaged && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-line">
              <span className="text-[11px] text-ink-3">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="min-h-[44px] sm:min-h-0"
                  disabled={page <= 1}
                  onClick={() => changePage(page - 1)}
                >
                  <HugeiconsIcon
                    icon={ArrowLeft01Icon}
                    size={12}
                    color="currentColor"
                    strokeWidth={2}
                  />
                  Prev
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="min-h-[44px] sm:min-h-0"
                  disabled={page >= totalPages}
                  onClick={() => changePage(page + 1)}
                >
                  Next
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    size={12}
                    color="currentColor"
                    strokeWidth={2}
                  />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
