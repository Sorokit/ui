import { Refresh01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useId, useState } from "react";

import { useSorokit } from "@/context/useSorokit";
import { cn } from "@/lib/utils";

const STROOPS_PER_XLM = 10_000_000;

type FeeBreakdown = {
  label: string;
  stroops: string;
  xlm: string;
  tooltip: string;
};

interface TransactionFeeCalculatorProps {
  className?: string;
  /** Operation types to include in the estimate */
  operations?: string[];
  /** Auto-refresh interval in ms. 0 = no refresh. */
  refreshInterval?: number;
}

function formatStroops(stroops: string): string {
  const num = parseInt(stroops, 10);
  if (isNaN(num)) return stroops;
  return num.toLocaleString();
}

function stroopsToXlm(stroops: string): string {
  const num = parseInt(stroops, 10);
  if (isNaN(num)) return "0";
  return (num / STROOPS_PER_XLM).toFixed(7);
}

function FeeRow({
  label,
  stroops,
  tooltip,
  highlight,
}: FeeBreakdown & { highlight?: boolean }) {
  const xlm = stroopsToXlm(stroops);
  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-2.5 border-b border-line last:border-0",
        highlight && "bg-brand-dim",
      )}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "text-[12px]",
            highlight ? "text-brand font-semibold" : "text-ink-2",
          )}
        >
          {label}
        </span>
        <span
          className="text-[10px] text-ink-4 cursor-help"
          title={tooltip}
          aria-label={tooltip}
        >
          ⓘ
        </span>
      </div>
      <div className="flex items-baseline gap-2.5">
        <span
          className={cn(
            "text-[13px] font-mono tabular-nums",
            highlight ? "text-brand font-semibold" : "text-ink",
          )}
        >
          {formatStroops(stroops)}
        </span>
        <span className="text-[10px] text-ink-3">stroops</span>
        <span className="text-[12px] text-ink-3 font-mono tabular-nums">
          {xlm} XLM
        </span>
      </div>
    </div>
  );
}

export function TransactionFeeCalculator({
  className,
  operations = ["payment"],
  refreshInterval = 0,
}: TransactionFeeCalculatorProps) {
  const { client } = useSorokit();
  const titleId = useId();
  const [feeData, setFeeData] = useState<FeeBreakdown[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } =
        await client.transaction.estimateDetailedFee({
          operations,
        });

      if (err) {
        setError(err);
        return;
      }

      if (!data) {
        setError("No fee data returned");
        return;
      }

      const breakdown: FeeBreakdown[] = data.breakdown.map((op) => ({
        label: op.operationType
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        stroops: op.feeStroops,
        xlm: op.feeXlm,
        tooltip: `Gas units: ${op.gasUnits.toLocaleString()}. Base fee applied per operation type.`,
      }));

      const totalStroops = data.breakdown
        .reduce((s, b) => s + parseInt(b.feeStroops, 10), 0)
        .toString();

      const totalXlm = stroopsToXlm(totalStroops);

      const scenarios = data.scenarios ?? [];
      const avgScenario = scenarios.find((s) => s.label === "average");
      const lowScenario = scenarios.find((s) => s.label === "low");

      breakdown.push({
        label: "Network Fee",
        stroops: avgScenario?.totalFeeStroops ?? totalStroops,
        xlm: avgScenario?.totalFeeXlm ?? totalXlm,
        tooltip:
          "Network fee charged by the Stellar network based on current load.",
      });

      if (lowScenario) {
        breakdown.push({
          label: "Base Fee",
          stroops: lowScenario.totalFeeStroops,
          xlm: lowScenario.totalFeeXlm,
          tooltip:
            "Minimum base fee required for transaction submission. Savings compared to average.",
        });
      }

      breakdown.push({
        label: "Total Estimated Fee",
        stroops: avgScenario?.totalFeeStroops ?? totalStroops,
        xlm: avgScenario?.totalFeeXlm ?? totalXlm,
        tooltip:
          "Total estimated cost including base fee and network surcharge.",
      });

      setFeeData(breakdown);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to estimate transaction fees",
      );
    } finally {
      setLoading(false);
    }
  }, [client, operations]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void load();
    }, 0);
    if (refreshInterval > 0) {
      const id = setInterval(() => {
        void load();
      }, refreshInterval);
      return () => {
        window.clearTimeout(timerId);
        clearInterval(id);
      };
    }
    return () => {
      window.clearTimeout(timerId);
    };
  }, [load, refreshInterval]);

  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-surface overflow-hidden",
        className,
      )}
      role="region"
      aria-labelledby={titleId}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <div>
          <h3 id={titleId} className="text-[13px] font-semibold text-ink">
            Transaction Fee Calculator
          </h3>
          <p className="text-[11px] text-ink-3 mt-0.5">
            Estimated fee breakdown for {operations.length > 0 ? operations.join(", ") : "selected"} operation(s)
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-surface-2 text-ink-3 hover:text-ink-2 transition-colors disabled:opacity-40"
          title="Refresh fee estimate"
          aria-label="Refresh fee estimate"
        >
          <HugeiconsIcon
            icon={Refresh01Icon}
            size={14}
            color="currentColor"
            strokeWidth={1.5}
            className={loading ? "animate-spin" : ""}
          />
        </button>
      </div>

      <div aria-live="polite" aria-atomic="true">
        {loading && !feeData ? (
          <div className="p-4 space-y-3">
            <div className="h-8 w-full rounded-lg bg-surface-2 animate-pulse" />
            <div className="h-8 w-full rounded-lg bg-surface-2 animate-pulse" />
            <div className="h-8 w-full rounded-lg bg-surface-2 animate-pulse" />
          </div>
        ) : error ? (
          <p className="text-[12px] text-red px-5 py-4">{error}</p>
        ) : feeData ? (
          <div>
            {feeData.map((row) => (
              <FeeRow
                key={row.label}
                label={row.label}
                stroops={row.stroops}
                xlm={row.xlm}
                tooltip={row.tooltip}
                highlight={row.label === "Total Estimated Fee"}
              />
            ))}
            <div className="px-5 py-3 bg-surface-2 border-t border-line">
              <p className="text-[10px] text-ink-4 leading-relaxed">
                Fees are estimates and may vary based on network conditions.
                Actual fee is determined at time of submission.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
