/**
 * SwapRoute — displays a list of suggested swaps needed to reach the target
 * allocation, with per-swap fee/slippage estimates and an execution status
 * indicator.
 */

import {
  AlertCircleIcon,
  ArrowRight01Icon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Copy01Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";

import { AssetPill } from "@/components/AssetBadge";
import { Badge } from "@/components/ui/Badge";
import type { SwapStatus,SwapSuggestion } from "@/lib/rebalancer";
import { formatPct, formatUsd, totalFeeStroops, totalRebalanceCostUsd, weightedAverageSlippage } from "@/lib/rebalancer";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SwapRouteProps {
  swaps: SwapSuggestion[];
  /** Optional per-swap execution status array (must match swaps length) */
  statuses?: SwapStatus[];
  /** Optional per-swap tx hashes revealed after execution */
  txHashes?: (string | null)[];
  /** Optional per-swap error messages */
  errors?: (string | null)[];
  className?: string;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: SwapStatus }) {
  switch (status) {
    case "success":
      return (
        <div className="w-6 h-6 rounded-full bg-success-dim flex items-center justify-center shrink-0">
          <HugeiconsIcon
            icon={CheckmarkCircle01Icon}
            size={13}
            color="currentColor"
            strokeWidth={1.5}
            className="text-green"
          />
        </div>
      );
    case "failed":
      return (
        <div className="w-6 h-6 rounded-full bg-error-dim flex items-center justify-center shrink-0">
          <HugeiconsIcon
            icon={Cancel01Icon}
            size={13}
            color="currentColor"
            strokeWidth={1.5}
            className="text-red"
          />
        </div>
      );
    case "submitting":
      return (
        <div className="w-6 h-6 rounded-full bg-brand-dim flex items-center justify-center shrink-0">
          <HugeiconsIcon
            icon={Loading03Icon}
            size={13}
            color="currentColor"
            strokeWidth={1.5}
            className="text-brand animate-spin"
          />
        </div>
      );
    case "skipped":
      return (
        <div className="w-6 h-6 rounded-full bg-surface-2 flex items-center justify-center shrink-0">
          <HugeiconsIcon
            icon={AlertCircleIcon}
            size={13}
            color="currentColor"
            strokeWidth={1.5}
            className="text-ink-3"
          />
        </div>
      );
    default:
      return (
        <div
          aria-hidden="true"
          className="w-6 h-6 rounded-full bg-surface-2 border border-line-2 shrink-0"
        />
      );
  }
}

function statusBadge(status: SwapStatus) {
  switch (status) {
    case "success":
      return <Badge variant="success" dot>Done</Badge>;
    case "failed":
      return <Badge variant="error" dot>Failed</Badge>;
    case "submitting":
      return <Badge variant="primary" dot live>Submitting…</Badge>;
    case "skipped":
      return <Badge variant="warning">Skipped</Badge>;
    default:
      return null;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SwapRowProps {
  swap: SwapSuggestion;
  index: number;
  status: SwapStatus;
  txHash?: string | null;
  error?: string | null;
}

const EXPLORER_TX_BASE = "https://stellar.expert/explorer/public/tx/";

function SwapRow({ swap, index, status, txHash, error }: SwapRowProps) {
  const badge = statusBadge(status);
  const [copied, setCopied] = useState(false);

  function handleCopyHash() {
    if (!txHash) return;
    // Issue #657: swallow clipboard rejections so they never escape unhandled.
    void Promise.resolve(navigator.clipboard?.writeText(txHash)).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div
      role="listitem"
      aria-label={`Swap ${index + 1}: sell ${swap.fromAmount.toFixed(4)} ${swap.from} for ${swap.toAmountExpected.toFixed(4)} ${swap.to}`}
      className={cn(
        "px-4 py-3.5 border-b border-line last:border-0 flex flex-col gap-2",
        status === "submitting" && "bg-brand-dim/30",
        status === "success" && "opacity-70",
      )}
    >
      {/* Swap direction row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-semibold text-ink-3 w-5 shrink-0 text-right">
          {index + 1}.
        </span>
        <StatusIcon status={status} />

        <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
          <span className="tabular-nums text-[13px] font-medium text-ink">
            {swap.fromAmount.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 4,
            })}
          </span>
          <AssetPill assetCode={swap.from} />

          <HugeiconsIcon
            icon={ArrowRight01Icon}
            size={13}
            color="currentColor"
            strokeWidth={2}
            className="text-ink-3 shrink-0"
            aria-hidden="true"
          />

          <span className="tabular-nums text-[13px] font-medium text-ink">
            ~{swap.toAmountExpected.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 4,
            })}
          </span>
          <AssetPill assetCode={swap.to} />
        </div>

        {badge && <div className="shrink-0">{badge}</div>}
      </div>

      {/* Metrics row */}
      <div className="flex items-center gap-4 pl-11 flex-wrap">
        <MetricPill label="Slippage" value={formatPct(swap.slippagePct)} />
        <MetricPill label="Swap fee" value={formatPct(swap.swapFeePct)} />
        <MetricPill label="Network fee" value={`${swap.feeStroops} stroops`} />
        <MetricPill label="Est. cost" value={formatUsd(swap.totalCostUsd)} highlight />
      </div>

      {/* Error message */}
      {status === "failed" && error && (
        <p className="pl-11 text-[11px] text-red">{error}</p>
      )}

      {/* Tx hash — copy + explorer link (issue #657) */}
      {status === "success" && txHash && (
        <div className="pl-11 flex flex-wrap items-center gap-2">
          <p className="text-[10px] text-ink-3 font-mono break-all">{txHash}</p>
          <button
            type="button"
            onClick={handleCopyHash}
            aria-label={
              copied ? "Transaction hash copied" : "Copy transaction hash"
            }
            className="inline-flex items-center gap-1 text-[10px] text-ink-4 hover:text-ink-2 shrink-0"
          >
            <HugeiconsIcon
              icon={Copy01Icon}
              size={11}
              color="currentColor"
              strokeWidth={1.5}
            />
            {copied ? "Copied" : "Copy"}
          </button>
          <a
            href={`${EXPLORER_TX_BASE}${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-brand hover:underline shrink-0"
          >
            View on explorer
          </a>
        </div>
      )}
    </div>
  );
}

function MetricPill({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <span className="flex items-center gap-1 text-[10px]">
      <span className="text-ink-4 uppercase tracking-[0.08em] font-semibold">{label}</span>
      <span className={cn("font-semibold tabular-nums", highlight ? "text-ink" : "text-ink-2")}>
        {value}
      </span>
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SwapRoute({
  swaps,
  statuses,
  txHashes,
  errors,
  className,
}: SwapRouteProps) {
  if (swaps.length === 0) {
    return (
      <div className={cn("rounded-xl border border-line bg-surface overflow-hidden", className)}>
        <div className="px-5 py-4 border-b border-line">
          <h3 className="text-[14px] font-semibold text-ink">Suggested Swaps</h3>
          <p className="text-[12px] text-ink-3 mt-0.5">Rebalancing path</p>
        </div>
        <p className="text-[13px] text-ink-3 text-center py-10">
          No swaps needed — portfolio is already at target allocation.
        </p>
      </div>
    );
  }

  // Issue #657: tolerate partial/mismatched status, hash and error arrays by
  // falling back per index rather than indexing past the array bounds.
  const resolvedStatuses: SwapStatus[] = statuses ?? swaps.map(() => "pending");
  const totalCost = totalRebalanceCostUsd(swaps);
  const totalFee = totalFeeStroops(swaps);
  const avgSlippage = weightedAverageSlippage(swaps);

  return (
    <div
      className={cn("rounded-xl border border-line bg-surface overflow-hidden", className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <div>
          <h3 className="text-[14px] font-semibold text-ink">Suggested Swaps</h3>
          <p className="text-[12px] text-ink-3 mt-0.5">
            {swaps.length} swap{swaps.length !== 1 ? "s" : ""} to reach target
          </p>
        </div>
        <Badge variant="default">{swaps.length}</Badge>
      </div>

      {/* Swap list */}
      <div role="list" aria-label="Suggested swaps">
        {swaps.map((swap, i) => (
          <SwapRow
            key={`${swap.from}-${swap.to}-${i}`}
            swap={swap}
            index={i}
            status={resolvedStatuses[i] ?? "pending"}
            txHash={txHashes?.[i]}
            error={errors?.[i]}
          />
        ))}
      </div>

      {/* Summary footer */}
      <div className="px-5 py-3.5 border-t border-line bg-surface-2/40 flex items-center gap-6 flex-wrap">
        <SummaryCell label="Total est. cost" value={formatUsd(totalCost)} highlight />
        <SummaryCell label="Total fees" value={`${totalFee} stroops`} />
        <SummaryCell label="Avg slippage" value={formatPct(avgSlippage)} />
        <SummaryCell label="Transactions" value={String(swaps.length)} />
      </div>
    </div>
  );
}

function SummaryCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">
        {label}
      </span>
      <span
        className={cn(
          "text-[13px] font-semibold tabular-nums",
          highlight ? "text-ink" : "text-ink-2",
        )}
      >
        {value}
      </span>
    </div>
  );
}
