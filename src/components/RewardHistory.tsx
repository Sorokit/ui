/**
 * RewardHistory — displays earned rewards over the last 30 days.
 *
 * Shows a hand-rolled SVG bar chart (matching the project's PieChart approach),
 * date-range filtering, CSV export with historical fiat values, and a
 * paginated tabular breakdown of individual reward events.
 */

import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Download01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import type { DailyReward, RewardEvent, Validator } from "@/lib/staking";
import {
  estimateRewardUsdValue,
  formatXlm,
  REWARD_HISTORY_DAYS,
  totalRewardHistoryXlm,
} from "@/lib/staking";
import { cn } from "@/lib/utils";

const DEFAULT_PAGE_SIZE = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RewardHistoryProps {
  /** Aggregated daily buckets (from aggregateDailyRewards()) */
  dailyRewards: DailyReward[];
  /** Raw reward events for the table */
  events: RewardEvent[];
  validators: Validator[];
  /** Number of rows per page (defaults to 10) */
  pageSize?: number;
  /** Optional initial start date filter (YYYY-MM-DD) */
  startDate?: string;
  /** Optional initial end date filter (YYYY-MM-DD) */
  endDate?: string;
  /** Optional callback for CSV export. If provided, called instead of DOM download. */
  onExport?: (csv: string) => void;
  className?: string;
}

// ─── Bar chart ────────────────────────────────────────────────────────────────

const CHART_WIDTH = 560;
const CHART_HEIGHT = 80;
const BAR_GAP = 2;

function RewardBarChart({ data }: { data: DailyReward[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-20 text-[12px] text-ink-3">
        No reward data
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.totalXlm), 0.001);
  const barW = Math.max(
    1,
    (CHART_WIDTH - BAR_GAP * (data.length - 1)) / data.length,
  );

  return (
    <svg
      role="img"
      aria-label={`Reward history bar chart — last ${REWARD_HISTORY_DAYS} days`}
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      className="w-full h-20 overflow-visible"
      preserveAspectRatio="none"
    >
      <title>Reward history — last {REWARD_HISTORY_DAYS} days</title>
      {data.map((day, i) => {
        const barHeight = Math.max(2, (day.totalXlm / maxVal) * CHART_HEIGHT);
        const x = i * (barW + BAR_GAP);
        const y = CHART_HEIGHT - barHeight;
        return (
          <g key={day.date}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={barHeight}
              rx={1.5}
              className="fill-brand opacity-70 hover:opacity-100 transition-opacity"
            />
            <title>
              {day.date}: {day.totalXlm.toFixed(4)} XLM
            </title>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validatorName(validators: Validator[], id: string): string {
  return validators.find((v) => v.id === id)?.name ?? id;
}

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function truncateTxHash(hash: string): string {
  if (hash.length <= 12) return hash;
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

function formatFiatUsd(value: number): string {
  if (!Number.isFinite(value)) return "$0.00";
  const decimals = value > 0 && value < 0.01 ? 4 : 2;
  return `$${value.toFixed(decimals)}`;
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function generateRewardHistoryCsv(
  events: RewardEvent[],
  validators: Validator[],
): string {
  const headers = [
    "Date",
    "Validator",
    "Amount (XLM)",
    "XLM Price (USD)",
    "Estimated Value (USD)",
    "Transaction Hash",
  ];
  const lines: string[] = [headers.join(",")];

  for (const event of events) {
    const vName = validatorName(validators, event.validatorId);
    const amountXlm = parseFloat(event.amount);
    const formattedAmount = Number.isFinite(amountXlm)
      ? amountXlm.toFixed(6)
      : "0.000000";
    const { priceUsd, usdValue } = estimateRewardUsdValue(event);

    lines.push(
      [
        escapeCsv(event.date),
        escapeCsv(vName),
        formattedAmount,
        priceUsd.toFixed(4),
        usdValue.toFixed(4),
        escapeCsv(event.txHash ?? ""),
      ].join(","),
    );
  }

  return lines.join("\n");
}

function downloadRewardCsv(
  events: RewardEvent[],
  validators: Validator[],
  onExport?: (csv: string) => void,
): void {
  const csv = generateRewardHistoryCsv(events, validators);

  if (onExport) {
    onExport(csv);
    return;
  }

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `reward-history-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RewardHistory({
  dailyRewards,
  events,
  validators,
  pageSize = DEFAULT_PAGE_SIZE,
  startDate = "",
  endDate = "",
  onExport,
  className,
}: RewardHistoryProps) {
  const [dateFrom, setDateFrom] = useState(startDate);
  const [dateTo, setDateTo] = useState(endDate);
  const [page, setPage] = useState(1);

  const [prevStartDate, setPrevStartDate] = useState(startDate);
  const [prevEndDate, setPrevEndDate] = useState(endDate);

  if (startDate !== prevStartDate) {
    setPrevStartDate(startDate);
    setDateFrom(startDate);
    setPage(1);
  }

  if (endDate !== prevEndDate) {
    setPrevEndDate(endDate);
    setDateTo(endDate);
    setPage(1);
  }

  const filteredDailyRewards = useMemo(() => {
    return dailyRewards.filter((day) => {
      const dayKey = day.date.slice(0, 10);
      if (dateFrom && dayKey < dateFrom) return false;
      if (dateTo && dayKey > dateTo) return false;
      return true;
    });
  }, [dailyRewards, dateFrom, dateTo]);

  const total = totalRewardHistoryXlm(filteredDailyRewards);

  // Filter and sort most recent events first
  const filteredEvents = useMemo(() => {
    return events
      .filter((event) => {
        const eventDateKey = event.date.slice(0, 10);
        if (dateFrom && eventDateKey < dateFrom) return false;
        if (dateTo && eventDateKey > dateTo) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [events, dateFrom, dateTo]);

  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / safePageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedEvents = filteredEvents.slice(
    (currentPage - 1) * safePageSize,
    currentPage * safePageSize,
  );

  const hasDateFilter = Boolean(dateFrom || dateTo);

  function handleDateFromChange(value: string) {
    setDateFrom(value);
    setPage(1);
  }

  function handleDateToChange(value: string) {
    setDateTo(value);
    setPage(1);
  }

  function handleClearFilters() {
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  return (
    <div className={cn("flex flex-col gap-5", className)}>

      {/* ── Summary header ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-4">
            Last {REWARD_HISTORY_DAYS} Days
          </p>
          <p className="text-[20px] font-semibold text-green leading-tight mt-0.5">
            {formatXlm(total)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {filteredDailyRewards.length > 0 && (
            <span className="text-[11px] text-ink-3">
              {filteredDailyRewards.length} reward days
            </span>
          )}
          {events.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              disabled={filteredEvents.length === 0}
              onClick={() =>
                downloadRewardCsv(filteredEvents, validators, onExport)
              }
              aria-label="Export CSV"
            >
              <HugeiconsIcon
                icon={Download01Icon}
                size={12}
                color="currentColor"
                strokeWidth={1.5}
              />
              <span>Export CSV</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── Date filter controls ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <label
            htmlFor="rh-date-from"
            className="text-[11px] text-ink-3 whitespace-nowrap"
          >
            From
          </label>
          <input
            id="rh-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => handleDateFromChange(e.target.value)}
            aria-label="Start date"
            className={cn(
              "h-8 rounded-lg border border-line bg-surface-2 px-2.5",
              "text-[12px] text-ink",
              "outline-none transition-colors focus:border-line-2 focus:ring-1 focus:ring-brand-dim",
            )}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label
            htmlFor="rh-date-to"
            className="text-[11px] text-ink-3 whitespace-nowrap"
          >
            To
          </label>
          <input
            id="rh-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => handleDateToChange(e.target.value)}
            aria-label="End date"
            className={cn(
              "h-8 rounded-lg border border-line bg-surface-2 px-2.5",
              "text-[12px] text-ink",
              "outline-none transition-colors focus:border-line-2 focus:ring-1 focus:ring-brand-dim",
            )}
          />
        </div>
        {hasDateFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            aria-label="Clear date filters"
          >
            Clear
          </Button>
        )}
      </div>

      {/* ── Bar chart ───────────────────────────────────────────────────────── */}
      <div className="rounded-lg bg-surface-2 border border-line px-3 pt-3 pb-2">
        <RewardBarChart data={filteredDailyRewards} />
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-ink-4">
            {filteredDailyRewards[0]?.date ?? ""}
          </span>
          <span className="text-[10px] text-ink-4">
            {filteredDailyRewards[filteredDailyRewards.length - 1]?.date ?? ""}
          </span>
        </div>
      </div>

      {/* ── Event table ─────────────────────────────────────────────────────── */}
      {filteredEvents.length > 0 ? (
        <div className="rounded-xl border border-line overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  <th
                    scope="col"
                    className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-4 whitespace-nowrap"
                  >
                    Date
                  </th>
                  <th
                    scope="col"
                    className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-4 whitespace-nowrap"
                  >
                    Validator
                  </th>
                  <th
                    scope="col"
                    className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-4 whitespace-nowrap"
                  >
                    Amount
                  </th>
                  <th
                    scope="col"
                    className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-4 whitespace-nowrap"
                  >
                    Est. USD
                  </th>
                  <th
                    scope="col"
                    className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-4 whitespace-nowrap"
                  >
                    Tx
                  </th>
                </tr>
              </thead>
              <tbody>
                {pagedEvents.map((event) => {
                  const { usdValue } = estimateRewardUsdValue(event);
                  return (
                    <tr
                      key={event.id}
                      className="border-b border-line last:border-b-0 hover:bg-surface-2 transition-colors"
                    >
                      <td className="px-4 py-2.5 text-ink-2 whitespace-nowrap">
                        {formatEventDate(event.date)}
                      </td>
                      <td className="px-4 py-2.5 text-ink truncate max-w-40">
                        {validatorName(validators, event.validatorId)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-green whitespace-nowrap">
                        +{parseFloat(event.amount).toFixed(4)} XLM
                      </td>
                      <td className="px-4 py-2.5 text-right text-ink-3 whitespace-nowrap tabular-nums">
                        {formatFiatUsd(usdValue)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-ink-3 whitespace-nowrap">
                        {event.txHash ? (
                          <span
                            title={event.txHash}
                            className="font-mono text-[11px]"
                          >
                            {truncateTxHash(event.txHash)}
                          </span>
                        ) : (
                          <span className="text-ink-4">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ──────────────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-line bg-surface">
              <span className="text-[11px] text-ink-3">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
        </div>
      ) : (
        <p className="text-[12px] text-ink-3 text-center py-6">
          {events.length > 0 && hasDateFilter
            ? "No reward events match the selected date range."
            : `No reward history in the last ${REWARD_HISTORY_DAYS} days.`}
        </p>
      )}
    </div>
  );
}
