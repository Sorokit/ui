import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Download01Icon,
  FilterIcon,
  SortByDown01Icon,
  SortByUp01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useSorokit } from "@/context/useSorokit";
import type { NetworkInfo, Transaction } from "@/lib/client";
import { cn, truncateAddress } from "@/lib/utils";

const PAGE_SIZE = 20;
const MEMO_TRUNCATE_LENGTH = 20;

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type SortField = "createdAt" | "ledger" | "feePaid" | "operationCount";
export type SortDirection = "asc" | "desc";

export interface TransactionFilters {
  status: "all" | "success" | "failed";
  dateFrom: string;
  dateTo: string;
  amountFrom: string;
  amountTo: string;
}

export interface TransactionHistoryTableProps {
  className?: string;
  pageSize?: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function formatDate(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
}

function truncateMemo(memo: string): string {
  return memo.length > MEMO_TRUNCATE_LENGTH
    ? `${memo.slice(0, MEMO_TRUNCATE_LENGTH)}…`
    : memo;
}

function matchesFilters(tx: Transaction, filters: TransactionFilters): boolean {
  if (filters.status !== "all") {
    if (filters.status === "success" && !tx.successful) return false;
    if (filters.status === "failed" && tx.successful) return false;
  }
  if (filters.dateFrom && new Date(tx.createdAt) < new Date(filters.dateFrom))
    return false;
  if (
    filters.dateTo &&
    new Date(tx.createdAt) > new Date(filters.dateTo + "T23:59:59")
  )
    return false;
  const feeNum = Number(tx.feePaid);
  if (filters.amountFrom && feeNum < Number(filters.amountFrom)) return false;
  if (filters.amountTo && feeNum > Number(filters.amountTo)) return false;
  return true;
}

function compareValues(
  a: Transaction,
  b: Transaction,
  field: SortField,
  dir: SortDirection,
): number {
  const aVal = a[field];
  const bVal = b[field];
  if (typeof aVal === "string" && typeof bVal === "string") {
    return dir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
  }
  const aNum = Number(aVal);
  const bNum = Number(bVal);
  return dir === "asc" ? aNum - bNum : bNum - aNum;
}

/**
 * Maps a Stellar network to its Stellar Expert explorer URL segment.
 * Returns `null` for networks Stellar Expert does not index (futurenet,
 * localnet), in which case the hash stays as plain text.
 */
function explorerTxUrl(
  network: NetworkInfo | null,
  hash: string,
): string | null {
  if (!network) return null;
  const segment =
    network.name === "mainnet"
      ? "public"
      : network.name === "testnet"
        ? "testnet"
        : null;
  if (!segment) return null;
  return `https://stellar.expert/explorer/${segment}/tx/${hash}`;
}

/* ------------------------------------------------------------------ */
/*  CSV Export (RFC 4180)                                              */
/* ------------------------------------------------------------------ */

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function generateCsv(rows: Transaction[]): Blob {
  const headers = [
    "Hash",
    "Ledger",
    "Date",
    "Time",
    "Status",
    "Fee (stroops)",
    "Operations",
    "Memo",
  ];
  const lines: string[] = [headers.join(",")];

  for (const tx of rows) {
    const { date, time } = formatDate(tx.createdAt);
    lines.push(
      [
        escapeCsv(tx.hash),
        tx.ledger,
        escapeCsv(date),
        escapeCsv(time),
        tx.successful ? "Success" : "Failed",
        tx.feePaid,
        tx.operationCount,
        escapeCsv(tx.memo ?? ""),
      ].join(","),
    );
  }

  return new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
}

function downloadCsv(rows: Transaction[]): void {
  const blob = generateCsv(rows);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/*  Status Icon                                                        */
/* ------------------------------------------------------------------ */

function StatusIcon({ successful }: { successful: boolean }) {
  return (
    <div
      className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
        successful ? "bg-success-dim" : "bg-error-dim",
      )}
    >
      <HugeiconsIcon
        icon={successful ? CheckmarkCircle01Icon : Cancel01Icon}
        size={12}
        color="currentColor"
        strokeWidth={1.5}
        className={successful ? "text-green" : "text-red"}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FilterBar                                                          */
/* ------------------------------------------------------------------ */

interface FilterBarProps {
  filters: TransactionFilters;
  onChange: (filters: TransactionFilters) => void;
  show: boolean;
  onToggle: () => void;
}

function FilterBar({ filters, onChange, show, onToggle }: FilterBarProps) {
  return (
    <div className="border-b border-line">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 text-[11px] font-medium text-ink-3 hover:text-ink transition-colors px-5 py-2 w-full"
      >
        <HugeiconsIcon
          icon={FilterIcon}
          size={12}
          color="currentColor"
          strokeWidth={1.5}
        />
        {show ? "Hide filters" : "Show filters"}
      </button>
      {show && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 px-5 pb-4">
          <select
            value={filters.status}
            onChange={(e) =>
              onChange({
                ...filters,
                status: e.target.value as TransactionFilters["status"],
              })
            }
            className="bg-surface border border-line rounded-lg px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-ink-3 transition-colors"
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
          <Input
            type="date"
            label=""
            value={filters.dateFrom}
            onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
            placeholder="From date"
            className="text-[12px]"
          />
          <Input
            type="date"
            label=""
            value={filters.dateTo}
            onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
            placeholder="To date"
            className="text-[12px]"
          />
          <Input
            type="number"
            label=""
            value={filters.amountFrom}
            onChange={(e) =>
              onChange({ ...filters, amountFrom: e.target.value })
            }
            placeholder="Min fee"
            className="text-[12px]"
          />
          <Input
            type="number"
            label=""
            value={filters.amountTo}
            onChange={(e) => onChange({ ...filters, amountTo: e.target.value })}
            placeholder="Max fee"
            className="text-[12px]"
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sortable Header                                                    */
/* ------------------------------------------------------------------ */

interface SortHeaderProps {
  label: string;
  field: SortField;
  currentField: SortField;
  direction: SortDirection;
  onChange: (field: SortField) => void;
  className?: string;
}

function SortHeader({
  label,
  field,
  currentField,
  direction,
  onChange,
  className,
}: SortHeaderProps) {
  const isActive = currentField === field;
  return (
    <th
      className={cn(
        "text-[11px] font-semibold text-ink-3 uppercase tracking-wider px-4 py-3 text-left cursor-pointer select-none hover:text-ink transition-colors",
        className,
      )}
      onClick={() => onChange(field)}
      aria-sort={
        isActive ? (direction === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <div className="flex items-center gap-1">
        {label}
        <HugeiconsIcon
          icon={isActive ? SortByUp01Icon : SortByDown01Icon}
          size={10}
          color="currentColor"
          strokeWidth={1.5}
          className={cn(
            "transition-transform",
            isActive && direction === "desc" && "rotate-180",
          )}
        />
      </div>
    </th>
  );
}

/* ------------------------------------------------------------------ */
/*  Transaction History Table                                          */
/* ------------------------------------------------------------------ */

export function TransactionHistoryTable({
  className,
  pageSize = PAGE_SIZE,
}: TransactionHistoryTableProps) {
  const { address, isConnected, network, client } = useSorokit();
  const [allTxs, setAllTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [filters, setFilters] = useState<TransactionFilters>({
    status: "all",
    dateFrom: "",
    dateTo: "",
    amountFrom: "",
    amountTo: "",
  });
  const [showFilters, setShowFilters] = useState(false);

  // Fetch all transactions
  useEffect(() => {
    if (!address || !client) return;
    let active = true;
    const timerId = window.setTimeout(() => {
      setLoading(true);
      client
        .transaction.getHistory(address, 1, 1000)
        .then(({ data, error: err }) => {
          if (!active) return;
          if (err) {
            setError(err);
            return;
          }
          setAllTxs(data ?? []);
          setError(null);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timerId);
    };
  }, [address, client]);

  useEffect(() => {
    queueMicrotask(() => {
      setPage((prev) => (prev !== 1 ? 1 : prev));
    });
  }, [filters]);

  // Toggle sort
  const handleSort = useCallback(
    (field: SortField) => {
      if (field === sortField) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir("desc");
      }
    },
    [sortField],
  );

  // Filter + sort + paginate
  const filtered = useMemo(
    () => allTxs.filter((tx) => matchesFilters(tx, filters)),
    [allTxs, filters],
  );
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => compareValues(a, b, sortField, sortDir)),
    [filtered, sortField, sortDir],
  );
  const totalFiltered = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-surface overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <div>
          <h3 className="text-[14px] font-semibold text-ink">
            Transaction History
          </h3>
          <p className="text-[12px] text-ink-3 mt-0.5">
            {totalFiltered > 0
              ? `${totalFiltered} transaction${totalFiltered !== 1 ? "s" : ""}`
              : "Past transactions"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <span className="w-4 h-4 border border-ink-3 border-t-transparent rounded-full animate-spin" />
          )}
          {allTxs.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => downloadCsv(allTxs)}
            >
              <HugeiconsIcon
                icon={Download01Icon}
                size={12}
                color="currentColor"
                strokeWidth={1.5}
              />
              <span className="hidden sm:inline">CSV</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <FilterBar
        filters={filters}
        onChange={setFilters}
        show={showFilters}
        onToggle={() => setShowFilters((s) => !s)}
      />

      {/* States */}
      {!isConnected ? (
        <div className="text-[13px] text-ink-3 text-center py-10">
          Connect your wallet to view history
        </div>
      ) : error ? (
        <div className="text-[13px] text-red text-center py-10">{error}</div>
      ) : loading && allTxs.length === 0 ? (
        <div className="px-5 py-4 flex flex-col gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-surface-2 shrink-0" />
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="h-3 w-32 rounded bg-surface-2" />
                <div className="h-2.5 w-20 rounded bg-surface-2" />
              </div>
              <div className="h-5 w-14 rounded-full bg-surface-2" />
            </div>
          ))}
        </div>
      ) : allTxs.length === 0 ? (
        <div className="text-[13px] text-ink-3 text-center py-10">
          No transactions found
        </div>
      ) : paged.length === 0 ? (
        <div className="text-[13px] text-ink-3 text-center py-10">
          No transactions match the current filters
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider px-4 py-3 text-left w-10" />
                  <SortHeader
                    label="Hash"
                    field="createdAt"
                    currentField={sortField}
                    direction={sortDir}
                    onChange={handleSort}
                  />
                  <SortHeader
                    label="Ledger"
                    field="ledger"
                    currentField={sortField}
                    direction={sortDir}
                    onChange={handleSort}
                    className="w-20 text-right"
                  />
                  <SortHeader
                    label="Date"
                    field="createdAt"
                    currentField={sortField}
                    direction={sortDir}
                    onChange={handleSort}
                    className="w-36"
                  />
                  <SortHeader
                    label="Fee"
                    field="feePaid"
                    currentField={sortField}
                    direction={sortDir}
                    onChange={handleSort}
                    className="w-28 text-right"
                  />
                  <SortHeader
                    label="Ops"
                    field="operationCount"
                    currentField={sortField}
                    direction={sortDir}
                    onChange={handleSort}
                    className="w-16 text-center"
                  />
                  <th className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider px-4 py-3 text-left w-24">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {paged.map((tx) => {
                  const { date, time } = formatDate(tx.createdAt);
                  return (
                    <tr
                      key={tx.hash}
                      className="border-b border-line last:border-0 hover:bg-surface-2/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <StatusIcon successful={tx.successful} />
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const url = explorerTxUrl(network, tx.hash);
                          return url ? (
                            <a
                              data-txhash
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[13px] text-ink font-mono hover:underline hover:text-brand inline-flex items-center gap-1"
                            >
                              {truncateAddress(tx.hash, 8, 6)}
                              <span aria-hidden="true" className="opacity-60">
                                ↗
                              </span>
                            </a>
                          ) : (
                            <span
                              data-txhash
                              className="text-[13px] text-ink font-mono"
                            >
                              {truncateAddress(tx.hash, 8, 6)}
                            </span>
                          );
                        })()}
                        {tx.memo && (
                          <span
                            className="block text-[10px] text-ink-3 mt-0.5"
                            title={tx.memo}
                          >
                            {truncateMemo(tx.memo)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-ink text-right font-mono">
                        {tx.ledger}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[13px] text-ink">{date}</span>
                        <span className="block text-[10px] text-ink-3">
                          {time}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-ink text-right font-mono">
                        {tx.feePaid}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-ink text-center">
                        {tx.operationCount}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={tx.successful ? "success" : "error"}
                          live
                        >
                          {tx.successful ? "Success" : "Failed"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden divide-y divide-line">
            {paged.map((tx) => {
              const { date, time } = formatDate(tx.createdAt);
              return (
                <div
                  key={tx.hash}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <StatusIcon successful={tx.successful} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const url = explorerTxUrl(network, tx.hash);
                        return url ? (
                          <a
                            data-txhash
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[13px] text-ink font-mono truncate hover:underline hover:text-brand"
                          >
                            {truncateAddress(tx.hash, 8, 6)}
                          </a>
                        ) : (
                          <span
                            data-txhash
                            className="text-[13px] text-ink font-mono truncate"
                          >
                            {truncateAddress(tx.hash, 8, 6)}
                          </span>
                        );
                      })()}
                      <Badge
                        variant={tx.successful ? "success" : "error"}
                        live
                        className="shrink-0"
                      >
                        {tx.successful ? "Success" : "Failed"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-ink-3">
                      <span>Ledger {tx.ledger}</span>
                      <span>·</span>
                      <span>
                        {date} {time}
                      </span>
                      <span>·</span>
                      <span>{tx.feePaid} stroops</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
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
                  onClick={() => setPage((p) => p + 1)}
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
