import { useCallback, useEffect, useState } from "react";
import { getClient } from "@/lib/client";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { Refresh01Icon } from "@hugeicons/core-free-icons";

interface FeeData {
  baseFee: string;
  recommended: string;
}

interface FeeEstimatorProps {
  className?: string;
  /** Auto-refresh interval in ms. 0 = no refresh. */
  refreshInterval?: number;
}

export function FeeEstimator({
  className,
  refreshInterval = 0,
}: FeeEstimatorProps) {
  const [fee, setFee] = useState<FeeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: err } = await getClient().transaction.estimateFee();
      if (err) {
        setError(err);
        return;
      }
      setFee(data);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, []);

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
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <div>
          <h3 className="text-[13px] font-semibold text-ink">Network Fee</h3>
          <p className="text-[11px] text-ink-3 mt-0.5">
            Current Stellar base fee estimate
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-surface-2 text-ink-3 hover:text-ink-2 transition-colors disabled:opacity-40"
          title="Refresh"
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

      <div className="px-5 py-4" aria-live="polite" aria-atomic="true">
        {loading && !fee ? (
          <div className="flex gap-4">
            <div className="h-8 w-24 rounded-lg bg-surface-2 animate-pulse" />
            <div className="h-8 w-24 rounded-lg bg-surface-2 animate-pulse" />
          </div>
        ) : error ? (
          <p className="text-[12px] text-red">{error}</p>
        ) : fee ? (
          <div className="flex items-center gap-4">
            <FeeCell label="Base Fee" value={fee.baseFee} unit="stroops" />
            <div className="w-px h-8 bg-line" />
            <FeeCell
              label="Recommended"
              value={fee.recommended}
              unit="stroops"
              highlight
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FeeCell({
  label,
  value,
  unit,
  highlight,
}: {
  label: string;
  value: string;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">
        {label}
      </span>
      <div className="flex items-baseline gap-1.5">
        <span
          className={cn(
            "text-[18px] font-semibold leading-none",
            highlight ? "text-brand" : "text-ink",
          )}
        >
          {value}
        </span>
        <span className="text-[10px] text-ink-3">{unit}</span>
      </div>
    </div>
  );
}
