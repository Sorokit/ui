/**
 * RebalancerHistory — shows past rebalance executions with before/after
 * allocations, swap counts, fees paid, and outcome badge.
 */

import { ArrowRight01Icon, ClockIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Badge } from "@/components/ui/Badge";
import type { RebalanceRecord } from "@/lib/rebalancer";
import { formatPct,formatUsd } from "@/lib/rebalancer";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RebalancerHistoryProps {
  records: RebalanceRecord[];
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  // Fixed locale + UTC so the output is deterministic across system locales and
  // timezones — `undefined` locale used to cause hydration mismatches and
  // flaky snapshots (issue #656).
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

/** Render the top-3 allocation slots from a snapshot (sorted by value desc) */
function TopAllocations({ alloc }: { alloc: Record<string, number> }) {
  const sorted = Object.entries(alloc)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {sorted.map(([code, pct]) => (
        <span
          key={code}
          className="inline-flex items-center gap-1 rounded-full bg-surface-2 border border-line-2 px-2 py-0.5 text-[10px] font-semibold text-ink-2"
        >
          {code}
          <span className="text-ink-3 font-normal tabular-nums">{formatPct(pct, 1)}</span>
        </span>
      ))}
      {Object.keys(alloc).length > 3 && (
        <span className="text-[10px] text-ink-3">
          +{Object.keys(alloc).length - 3} more
        </span>
      )}
    </div>
  );
}

// ─── Row component ─────────────────────────────────────────────────────────────

function HistoryRow({ record }: { record: RebalanceRecord }) {
  return (
    <div
      role="article"
      aria-label={`Rebalance on ${formatDate(record.executedAt)} — ${record.successful ? "successful" : "failed"}`}
      className="px-5 py-4 border-b border-line last:border-0 flex flex-col gap-3"
    >
      {/* Top row: date + outcome */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-medium text-ink">
          {formatDate(record.executedAt)}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={record.successful ? "success" : "error"} dot>
            {record.successful ? "Completed" : "Partial"}
          </Badge>
        </div>
      </div>

      {/* Allocation change: before → after */}
      <div className="flex items-start gap-3">
        <div className="flex-1 flex flex-col gap-1 min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-4">
            Before
          </span>
          <TopAllocations alloc={record.before} />
        </div>

        <HugeiconsIcon
          icon={ArrowRight01Icon}
          size={14}
          color="currentColor"
          strokeWidth={2}
          className="text-ink-3 mt-3 shrink-0"
          aria-hidden="true"
        />

        <div className="flex-1 flex flex-col gap-1 min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-4">
            After
          </span>
          <TopAllocations alloc={record.after} />
        </div>
      </div>

      {/* Footer metrics */}
      <div className="flex items-center gap-4 flex-wrap">
        <HistoryMetric label="Swaps" value={String(record.swaps.length)} />
        <HistoryMetric label="Total fee" value={formatUsd(record.totalFeeUsd)} />
        {record.txHashes.length > 0 && (
          <HistoryMetric
            label="Tx"
            value={`${record.txHashes.length} confirmed`}
          />
        )}
      </div>
    </div>
  );
}

function HistoryMetric({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-center gap-1 text-[11px]">
      <span className="text-ink-4 uppercase tracking-[0.08em] font-semibold text-[10px]">
        {label}
      </span>
      <span className="text-ink-2 font-medium tabular-nums">{value}</span>
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RebalancerHistory({
  records,
  className,
}: RebalancerHistoryProps) {
  return (
    <div
      className={cn("rounded-xl border border-line bg-surface overflow-hidden", className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <div>
          <h3 className="text-[14px] font-semibold text-ink">Rebalancing History</h3>
          <p className="text-[12px] text-ink-3 mt-0.5">Past rebalance operations</p>
        </div>
        {records.length > 0 && (
          <Badge variant="default">{records.length}</Badge>
        )}
      </div>

      {records.length === 0 ? (
        /* Issue #656: a proper empty state with an icon and guidance instead of
           an unstyled blank area. */
        <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
          <HugeiconsIcon
            icon={ClockIcon}
            size={22}
            color="currentColor"
            strokeWidth={1.5}
            className="text-ink-4"
            aria-hidden="true"
          />
          <p className="text-[13px] font-medium text-ink-2">
            No rebalance history yet
          </p>
          <p className="text-[12px] text-ink-3">
            Run a rebalance to see before/after allocations and fees here.
          </p>
        </div>
      ) : (
        <div>
          {/* Show most recent first */}
          {[...records]
            .sort(
              (a, b) =>
                new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime(),
            )
            .map((record) => (
              <HistoryRow key={record.id} record={record} />
            ))}
        </div>
      )}
    </div>
  );
}
