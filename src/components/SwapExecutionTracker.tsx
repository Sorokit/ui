import { useEffect, useState } from "react";

import { AssetPill } from "@/components/AssetBadge";
import { Badge } from "@/components/ui/Badge";
import type { SwapSuggestion } from "@/lib/rebalancer";
import { formatPct } from "@/lib/rebalancer";

export type SwapExecutionStatus =
  | "submitted"
  | "confirming"
  | "success"
  | "timeout"
  | "failed";

export interface SwapExecutionTrackerProps {
  swap: SwapSuggestion;
  txHash?: string | null;
  executedAt?: string | null;
  actualOutput?: number | null;
  slippageThresholdPct?: number;
  priceImpactPct?: number;
  explorerUrl?: string | null;
  className?: string;
  status?: SwapExecutionStatus;
  timeoutSeconds?: number;
  onRetry?: () => void;
}

function formatTimestamp(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function getSlippageState(slippagePct: number, thresholdPct?: number) {
  if (thresholdPct == null) {
    return { label: "Within threshold", tone: "success" as const };
  }
  if (slippagePct > thresholdPct) {
    return { label: "Warning: slippage exceeded threshold", tone: "warning" as const };
  }
  return { label: "Within threshold", tone: "success" as const };
}

export function SwapExecutionTracker({
  swap,
  txHash,
  executedAt,
  actualOutput,
  slippageThresholdPct,
  priceImpactPct,
  explorerUrl,
  className,
  status: statusProp,
  timeoutSeconds = 60,
  onRetry,
}: SwapExecutionTrackerProps) {
  // Determine effective execution status
  const [internalStatus, setInternalStatus] = useState<SwapExecutionStatus>(() => {
    if (statusProp) return statusProp;
    if (executedAt || actualOutput != null) return "success";
    if (txHash) return "confirming";
    return "submitted";
  });

  const [timeLeft, setTimeLeft] = useState(timeoutSeconds);

  useEffect(() => {
    if (statusProp) {
      setInternalStatus(statusProp);
    } else if (executedAt || actualOutput != null) {
      setInternalStatus("success");
    }
  }, [statusProp, executedAt, actualOutput]);

  // Handle timeout countdown for pending states (submitted / confirming)
  useEffect(() => {
    setTimeLeft(timeoutSeconds);
  }, [timeoutSeconds, internalStatus]);

  useEffect(() => {
    const isPending = internalStatus === "submitted" || internalStatus === "confirming";
    if (!isPending) return;

    if (timeLeft <= 0) {
      setInternalStatus("timeout");
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setInternalStatus("timeout");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [internalStatus, timeLeft]);

  const currentStatus = internalStatus;
  const isTimedOut = currentStatus === "timeout";
  const isFailed = currentStatus === "failed";
  const isPending = currentStatus === "submitted" || currentStatus === "confirming";

  const expectedMinimumOutput = swap.toAmountExpected;
  const resolvedActualOutput = actualOutput ?? expectedMinimumOutput;
  const actualSlippagePct = expectedMinimumOutput > 0
    ? ((expectedMinimumOutput - resolvedActualOutput) / expectedMinimumOutput) * 100
    : 0;
  const { label: slippageLabel, tone: slippageTone } = getSlippageState(actualSlippagePct, slippageThresholdPct);

  const getBadgeDetails = () => {
    if (isTimedOut) return { label: "Transaction Timed Out", variant: "warning" as const };
    if (isFailed) return { label: "Transaction Failed", variant: "warning" as const };
    if (currentStatus === "submitted") return { label: "Submitted", variant: "default" as const };
    if (currentStatus === "confirming") return { label: "Confirming...", variant: "default" as const };
    return { label: slippageLabel, variant: slippageTone === "warning" ? "warning" as const : "success" as const };
  };

  const badgeDetails = getBadgeDetails();
  const effectiveExplorerUrl = explorerUrl ?? (txHash ? `https://stellar.expert/explorer/testnet/tx/${txHash}` : null);

  return (
    <div className={className ?? "rounded-xl border border-line bg-surface overflow-hidden"}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <h3 className="text-[14px] font-semibold text-ink">Swap execution tracker</h3>
          <p className="text-[12px] text-ink-3 mt-0.5">Live execution details and slippage monitoring</p>
        </div>
        <Badge variant={badgeDetails.variant}>{badgeDetails.label}</Badge>
      </div>

      {/* Execution Lifecycle Stepper */}
      <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-line bg-surface-2/40 text-[12px]">
        <div className="flex items-center gap-1.5 font-medium">
          <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px]">✓</span>
          <span className={currentStatus === "submitted" ? "text-ink font-semibold" : "text-ink-2"}>Submitted</span>
        </div>
        <div className="h-[1px] flex-1 bg-line" />
        <div className="flex items-center gap-1.5 font-medium">
          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${
            currentStatus === "confirming" ? "bg-brand text-white animate-pulse" :
            isTimedOut || isFailed ? "bg-amber-500 text-white" :
            currentStatus === "success" ? "bg-emerald-500 text-white" : "bg-surface-3 text-ink-4"
          }`}>
            {currentStatus === "confirming" ? "…" : isTimedOut || isFailed ? "!" : currentStatus === "success" ? "✓" : "2"}
          </span>
          <span className={currentStatus === "confirming" ? "text-ink font-semibold" : "text-ink-2"}>
            Confirming {isPending && `(${timeLeft}s)`}
          </span>
        </div>
        <div className="h-[1px] flex-1 bg-line" />
        <div className="flex items-center gap-1.5 font-medium">
          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${
            currentStatus === "success" ? "bg-emerald-500 text-white" :
            isTimedOut ? "bg-amber-500 text-white" : "bg-surface-3 text-ink-4"
          }`}>
            {currentStatus === "success" ? "✓" : isTimedOut ? "!" : "3"}
          </span>
          <span className={currentStatus === "success" ? "text-ink font-semibold" : isTimedOut ? "text-amber-500 font-semibold" : "text-ink-4"}>
            {isTimedOut ? "Timed Out" : "Confirmed"}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-5 py-4">
        {/* Timeout Alert Banner */}
        {isTimedOut && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-ink" role="alert">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold text-amber-500">Transaction Timed Out</p>
                <p className="text-[12px] text-ink-3 mt-0.5">
                  The transaction was not confirmed within {timeoutSeconds} seconds. It may have dropped from the transaction pool due to network congestion or low fees.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {effectiveExplorerUrl && (
                  <a
                    href={effectiveExplorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center h-8 px-3 rounded-lg bg-surface border border-line text-[12px] font-medium text-brand hover:underline"
                    aria-label="Check explorer for transaction"
                  >
                    Check Explorer ↗
                  </a>
                )}
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="inline-flex items-center h-8 px-3 rounded-lg bg-brand text-white text-[12px] font-medium hover:bg-brand/90 transition-colors cursor-pointer"
                  >
                    Retry Swap
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Metric Cards */}
        <div className="grid gap-3 md:grid-cols-2">
          <MetricCard title="Source" value={`${swap.fromAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${swap.from}`} icon={<AssetPill assetCode={swap.from} />} />
          <MetricCard title="Destination" value={`${resolvedActualOutput.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${swap.to}`} icon={<AssetPill assetCode={swap.to} />} />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <MetricCard title="Price impact" value={formatPct(priceImpactPct ?? swap.slippagePct)} />
          <MetricCard title="Expected minimum output" value={`${expectedMinimumOutput.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${swap.to}`} />
          <MetricCard title="Actual output" value={`${resolvedActualOutput.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${swap.to}`} />
        </div>

        <div className="rounded-lg border border-line bg-surface-2 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold text-ink">Slippage</p>
              <p className="text-[11px] text-ink-3">Calculated as (min_output - actual) / min_output × 100</p>
            </div>
            <div className={slippageTone === "warning" ? "text-red" : "text-success"}>
              <p className="text-[13px] font-semibold">{formatPct(actualSlippagePct)}</p>
            </div>
          </div>
        </div>

        {/* Footer info & Explorer Link */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-[12px] text-ink-3">
          <div className="flex items-center gap-2">
            <span aria-hidden="true">↗</span>
            <span>Executed {formatTimestamp(executedAt)}</span>
          </div>
          {txHash ? (
            <a
              href={effectiveExplorerUrl ?? `https://stellar.expert/explorer/testnet/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-brand underline-offset-2 hover:underline"
              aria-label="View on explorer"
            >
              <span aria-hidden="true">↗</span>
              View on explorer
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon }: { title: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-4">{title}</p>
        {icon}
      </div>
      <p className="mt-2 text-[13px] font-medium text-ink">{value}</p>
    </div>
  );
}

