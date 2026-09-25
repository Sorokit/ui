import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  ChevronDownIcon,
  CircleXIcon,
  Copy01Icon,
  FilterIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useSorokit } from "@/context/useSorokit";
import type { GroupedTransaction, Operation, TimelineFilter, TimelineGroup } from "@/lib/client";
import { cn, truncateAddress } from "@/lib/utils";

const PAGE_SIZE = 10;
const OPERATION_TYPES = [
  { value: "all", label: "All Operations" },
  { value: "payment", label: "Payments" },
  { value: "trade", label: "Trades" },
  { value: "trustline", label: "Trustlines" },
  { value: "account_merge", label: "Account Merge" },
  { value: "manage_data", label: "Manage Data" },
  { value: "create_account", label: "Create Account" },
  { value: "set_options", label: "Set Options" },
  { value: "change_trust", label: "Change Trust" },
  { value: "allow_trust", label: "Allow Trust" },
  { value: "account_creator", label: "Account Creator" },
];

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatAmount(amount: string, asset: string): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return `${amount} ${asset}`;
  return `${num.toFixed(4)} ${asset}`;
}

function explorerTxUrl(networkName: string | null, hash: string): string | null {
  if (!networkName) return null;
  const segment =
    networkName === "mainnet"
      ? "public"
      : networkName === "testnet"
        ? "testnet"
        : null;
  if (!segment) return null;
  return `https://stellar.expert/explorer/${segment}/tx/${hash}`;
}

function OperationTypeIcon({ type }: { type: string }) {
  const iconMap: Record<string, React.ReactNode> = {
    payment: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
    ),
    trade: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
    ),
    trustline: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
    ),
    account_merge: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v10M1 12h6m6 0h10"/></svg>
    ),
    manage_data: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    ),
    create_account: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-7 8-7s8 3 8 7"/><line x1="4" y1="20" x2="20" y2="20"/></svg>
    ),
    set_options: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6M1 12h6m6 0h10"/></svg>
    ),
    change_trust: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
    ),
    allow_trust: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
    ),
    account_creator: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-7 8-7s8 3 8 7"/></svg>
    ),
  };
  return (
    <span className="text-ink-3 shrink-0">
      {iconMap[type.toLowerCase()] ?? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      )}
    </span>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-line animate-pulse">
      <div className="w-8 h-8 rounded-full bg-surface-2 shrink-0" />
      <div className="flex-1 flex flex-col gap-1.5">
        <div className="h-3 w-32 rounded bg-surface-2" />
        <div className="h-2.5 w-20 rounded bg-surface-2" />
      </div>
      <div className="h-5 w-14 rounded-full bg-surface-2 shrink-0" />
    </div>
  );
}

function OperationRow({ op }: { op: Operation }) {
  return (
    <div className="flex flex-col gap-3 py-3 pl-6 pr-3 border-l-2 border-line">
      <div className="flex items-center gap-2">
        <OperationTypeIcon type={op.type} />
        <span className="text-[13px] font-medium text-ink">{op.type}</span>
        <Badge variant={op.success ? "success" : "error"} className="text-[10px]">
          {op.success ? "Success" : "Failed"}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
        <span className="text-ink-4">Source</span>
        <span data-source className="font-mono text-ink-2 truncate" title={op.source}>
          {truncateAddress(op.source, 8, 6)}
        </span>
        <span className="text-ink-4">Destination</span>
        <span data-destination className="font-mono text-ink-2 truncate" title={op.destination}>
          {truncateAddress(op.destination, 8, 6)}
        </span>
        <span className="text-ink-4">Amount</span>
        <span data-amount className="text-ink-2">{formatAmount(op.amount, op.asset)}</span>
        <span className="text-ink-4">Fee</span>
        <span data-fee className="text-ink-2">{op.fee} stroops</span>
        {op.memo && (
          <>
            <span className="text-ink-4">Memo</span>
            <span data-memo className="text-ink-2 truncate" title={op.memo}>{op.memo}</span>
          </>
        )}
      </div>
    </div>
  );
}

function GroupedTxRow({ tx, onCopy, explorerUrl }: { tx: GroupedTransaction; onCopy: (hash: string) => void; explorerUrl: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const isExpanded = expanded;

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`Transaction ${truncateAddress(tx.hash, 8, 6)} — ${tx.status === "success" ? "Success" : "Failed"} — ${tx.operationCount} operations`}
        className="flex items-center justify-between px-5 py-3.5 border-b border-line cursor-pointer hover:bg-surface-2 transition-colors gap-3"
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleToggle();
          }
        }}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
            tx.status === "success" ? "bg-success-dim" : "bg-error-dim",
          )}>
            <HugeiconsIcon
              icon={tx.status === "success" ? CheckmarkCircle01Icon : CircleXIcon}
              size={12}
              color="currentColor"
              strokeWidth={1.5}
              className={tx.status === "success" ? "text-green" : "text-red"}
            />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="truncate text-[13px] font-mono text-ink">
              {truncateAddress(tx.hash, 8, 6)}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-ink-3">{tx.date} {tx.time}</span>
              <span className="text-[10px] text-ink-3">· {tx.type}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={tx.status === "success" ? "success" : "error"}>
            {tx.status === "success" ? "Success" : "Failed"}
          </Badge>
          <span className="text-[11px] text-ink-3">{tx.totalAmount}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onCopy(tx.hash); }}
            className="p-1 rounded hover:bg-surface-2 text-ink-3 hover:text-ink transition-colors"
            aria-label={`Copy transaction hash ${truncateAddress(tx.hash, 8, 6)}`}
            title="Copy transaction hash"
          >
            <HugeiconsIcon icon={Copy01Icon} size={13} strokeWidth={1.5} />
          </button>
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1 rounded hover:bg-surface-2 text-ink-3 hover:text-ink transition-colors"
              aria-label={`View transaction ${truncateAddress(tx.hash, 8, 6)} on block explorer`}
              title="View on block explorer"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 5h5v5"/><path d="M19 5l-8 8"/><path d="M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4"/></svg>
            </a>
          )}
          <BigChevronIcon expanded={isExpanded} />
        </div>
      </div>
      {isExpanded && (
        <div className="px-5 py-4 border-b border-line bg-surface">
          <div className="flex flex-col gap-2 mb-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">Operations ({tx.operations.length})</span>
          </div>
          <div className="flex flex-col gap-1">
            {tx.operations.map((op) => (
              <OperationRow key={op.id} op={op} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BigChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <HugeiconsIcon
      icon={ChevronDownIcon}
      size={16}
      color="currentColor"
      strokeWidth={1.5}
      className={cn("text-ink-3 transition-transform duration-200", expanded ? "rotate-180" : "")}
    />
  );
}

export function ActivityTimeline({ className }: { className?: string }) {
  const { address, isConnected, network, client } = useSorokit();
  const [groups, setGroups] = useState<TimelineGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<TimelineFilter>({ operationType: "all" });
  const [filterOpen, setFilterOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const loadTimeline = useCallback(() => {
    if (!address || !client) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);

    const f: TimelineFilter = {};
    if (filters.operationType && filters.operationType !== "all") {
      f.operationType = filters.operationType;
    }
    if (dateFrom) f.dateFrom = dateFrom;
    if (dateTo) f.dateTo = dateTo;
    if (searchInput.trim()) f.searchQuery = searchInput.trim();

    client
      .operation.getTimeline({
        address,
        page,
        limit: PAGE_SIZE,
        filters: f,
      })
      .then(({ data, error: err, total: t }) => {
        if (err) {
          setError(err);
          return;
        }
        setGroups(data ?? []);
        setTotal(t);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load activity");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [address, client, page, filters, dateFrom, dateTo, searchInput]);

  useEffect(() => {
    if (!address) return;
    const timerId = window.setTimeout(() => {
      void loadTimeline();
    }, 0);
    return () => {
      window.clearTimeout(timerId);
    };
  }, [address, loadTimeline]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleCopyHash = useCallback((hash: string) => {
    navigator.clipboard.writeText(hash).catch(() => {});
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({ operationType: "all" });
    setDateFrom("");
    setDateTo("");
    setSearchInput("");
    setPage(1);
  }, []);

  const hasActiveFilters =
    filters.operationType !== "all" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    searchInput !== "";

  return (
    <div
      role="region"
      aria-label="Activity Timeline"
      className={cn("rounded-xl border border-line bg-surface overflow-hidden", className)}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <div>
          <h3 className="text-[14px] font-semibold text-ink">Activity Timeline</h3>
          <p className="text-[12px] text-ink-3 mt-0.5">
            {total > 0 ? `${total} transactions` : "No transactions yet"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors",
              filterOpen || hasActiveFilters
                ? "bg-brand-dim text-brand border border-brand/20"
                : "bg-surface-2 text-ink-3 border border-line hover:bg-surface-2",
            )}
            aria-label="Toggle filters"
          >
            <HugeiconsIcon icon={FilterIcon} size={13} strokeWidth={1.5} />
            Filters
            {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-brand" />}
          </button>
        </div>
      </div>

      {filterOpen && (
        <div className="px-5 py-4 border-b border-line bg-surface-2 flex flex-col gap-3 animate-in fade-in">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col gap-1.5 min-w-[160px]">
              <label htmlFor="at-operation-type" className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">Operation Type</label>
              <select
                id="at-operation-type"
                value={filters.operationType ?? "all"}
                onChange={(e) => setFilters((prev) => ({ ...prev, operationType: e.target.value }))}
                className="h-9 w-full rounded-lg border border-line bg-surface-2 px-3 text-[13px] text-ink outline-none focus:border-line-2 focus:ring-1 focus:ring-brand-dim disabled:opacity-40"
              >
                {OPERATION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5 min-w-[130px]">
              <label htmlFor="at-date-from" className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">From</label>
              <input
                id="at-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 w-full rounded-lg border border-line bg-surface-2 px-3 text-[13px] text-ink outline-none focus:border-line-2 focus:ring-1 focus:ring-brand-dim disabled:opacity-40"
              />
            </div>
            <div className="flex flex-col gap-1.5 min-w-[130px]">
              <label htmlFor="at-date-to" className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">To</label>
              <input
                id="at-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 w-full rounded-lg border border-line bg-surface-2 px-3 text-[13px] text-ink outline-none focus:border-line-2 focus:ring-1 focus:ring-brand-dim disabled:opacity-40"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px] flex items-center gap-2">
              <HugeiconsIcon icon={Search01Icon} size={14} strokeWidth={1.5} className="text-ink-3 shrink-0" />
              <Input
                id="at-search"
                placeholder="Search by address or transaction hash..."
                aria-label="Search by address or transaction hash"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void loadTimeline();
                  }
                }}
                className="h-9"
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="min-h-[44px] sm:min-h-0"
              onClick={() => void loadTimeline()}
            >
              Apply
            </Button>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="min-h-[44px] sm:min-h-0 text-ink-3"
                onClick={resetFilters}
              >
                Clear All
              </Button>
            )}
          </div>
        </div>
      )}

      {!isConnected ? (
        <p className="text-[13px] text-ink-3 text-center py-10">
          Connect your wallet to view activity
        </p>
      ) : error ? (
        <div className="flex items-start gap-3 px-5 py-4">
          <div className="w-8 h-8 rounded-full bg-error-dim flex items-center justify-center shrink-0 mt-0.5">
            <HugeiconsIcon icon={CircleXIcon} size={16} color="currentColor" strokeWidth={1.5} className="text-red" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-ink">Failed to load activity</p>
            <p className="text-[12px] text-red mt-0.5">{error}</p>
            <Button variant="secondary" size="sm" className="mt-2" onClick={() => void loadTimeline()}>
              Retry
            </Button>
          </div>
        </div>
      ) : loading && groups.length === 0 ? (
        <div className="px-5 py-4 flex flex-col gap-0">
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <p className="text-[13px] text-ink-3 text-center py-10">
          {hasActiveFilters ? "No transactions match your filters" : "No activity yet"}
        </p>
      ) : (
        <>
          <div>
            {groups.map((group, groupIndex) => (
              <div key={group.date}>
                {groupIndex > 0 && (
                  <div className="flex items-center gap-3 px-5 py-2">
                    <div className="flex-1 h-px bg-line" />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-4">
                      {formatDateLabel(group.date)}
                    </span>
                    <div className="flex-1 h-px bg-line" />
                  </div>
                )}
                {groupIndex === 0 && (
                  <div className="px-5 py-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-4">
                      {formatDateLabel(group.date)}
                    </span>
                  </div>
                )}
                {group.transactions.map((tx) => {
                  const url = explorerTxUrl(network?.name ?? null, tx.hash);
                  return (
                    <GroupedTxRow
                      key={tx.hash}
                      tx={tx}
                      onCopy={handleCopyHash}
                      explorerUrl={url}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {totalPages > 1 && (
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
                  onClick={() => setPage((p) => p - 1)}
                >
                  <HugeiconsIcon icon={ArrowLeft01Icon} size={12} strokeWidth={2} />
                  Prev
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="min-h-[44px] sm:min-h-0"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <HugeiconsIcon icon={ArrowRight01Icon} size={12} strokeWidth={2} />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}