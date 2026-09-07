import { Refresh01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Tooltip } from "@/components/ui/Tooltip";
import { useSorokit } from "@/context/useSorokit";
import { useIsVisible } from "@/hooks/useIsVisible";
import { cn, toXLM } from "@/lib/utils";

export interface FeeData {
  baseFee: string;
  recommended: string;
}

interface FeeEstimatorProps {
  className?: string;
  /** Auto-refresh interval in ms. 0 = no refresh. */
  refreshInterval?: number;
  /** Compact single-line display variant. */
  compact?: boolean;
  /** Callback fired when fee data loads successfully. */
  onFeeLoad?: (fee: FeeData) => void;
}

export function FeeEstimator({
  className,
  refreshInterval = 0,
  compact,
  onFeeLoad,
}: FeeEstimatorProps) {
  const { client } = useSorokit();
  const [containerRef, isVisible] = useIsVisible<HTMLDivElement>();
  const [fee, setFee] = useState<FeeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Issue #442: `onFeeLoad` is normally an inline arrow, so it had a new
  // identity on every parent render. As a `load` dependency that rebuilt
  // `load`, re-ran the effect and fired another request per render (and the
  // callback itself usually sets parent state, so it fed itself). Kept in a ref
  // instead: the latest callback is always used, but `load` only depends on
  // `client`, so mount performs exactly one request.
  const onFeeLoadRef = useRef(onFeeLoad);
  useEffect(() => {
    onFeeLoadRef.current = onFeeLoad;
  }, [onFeeLoad]);
  // Issue #442: generation counter - an estimate that resolves after a newer
  // one started is discarded rather than overwriting fresher data.
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!client) return;
    const requestId = ++requestIdRef.current;
    const isStale = () => requestId !== requestIdRef.current;
    setLoading(true);
    try {
      const { data, error: err } = await client.transaction.estimateFee();
      if (isStale()) return;
      if (err) {
        setError(err);
        return;
      }
      setFee(data);
      setError(null);
      if (data) {
        onFeeLoadRef.current?.(data);
      }
    } finally {
      // Issue #442: a stale call must not clear the spinner owned by the
      // request that superseded it.
      if (!isStale()) setLoading(false);
    }
  }, [client]);

  // Issue #442: one effect owns both the initial fetch and the poll timer, so
  // mount makes exactly one request and a changed `refreshInterval` re-arms the
  // timer at the new period.
  useEffect(() => {
    // Dashboard keeps a visited screen mounted (rather than unmounting it)
    // to preserve in-progress state — see the comment in Dashboard.tsx.
    // That means a screen navigated away from is still mounted, just
    // hidden; without this check, a refreshInterval keeps firing network
    // requests for a screen the user can no longer see (#533).
    if (!isVisible) return;

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
  }, [load, refreshInterval, isVisible]);

  const compactContent = fee
    ? `Base: ${fee.baseFee} stroops · Recommended: ${fee.recommended} stroops`
    : null;

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Network fee estimate"
      className={cn(
        compact
          ? "inline-flex items-center gap-2"
          : "rounded-xl border border-line bg-surface overflow-hidden",
        className,
      )}
    >
      {compact ? (
        <div aria-live="polite" aria-atomic="true">
          {loading && !fee ? (
            <span className="text-[11px] text-ink-3">Loading…</span>
          ) : error ? (
            <span className="text-[11px] text-red">{error}</span>
          ) : fee ? (
            <span className="text-[11px] text-ink">{compactContent}</span>
          ) : null}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-5 py-4 border-b border-line">
            <div>
              <h3 className="text-[13px] font-semibold text-ink">Network Fee</h3>
              <p className="text-[11px] text-ink-3 mt-0.5">
                Current Stellar base fee estimate
              </p>
            </div>
            <Tooltip content="Refresh">
              <button
                onClick={() => void load()}
                disabled={loading}
                className="p-1.5 rounded-lg hover:bg-surface-2 text-ink-3 hover:text-ink-2 transition-colors disabled:opacity-40"
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
            </Tooltip>
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
                  highFee={
                    parseInt(fee.recommended, 10) > parseInt(fee.baseFee, 10) * 2
                  }
                />
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

export function FeeCell({
  label,
  value,
  unit,
  highlight,
  highFee,
}: {
  label: string;
  value: string;
  unit: string;
  highlight?: boolean;
  highFee?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">
          {label}
        </span>
        {highFee && <Badge variant="warning">High fee</Badge>}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span
          className={cn(
            "text-[18px] font-semibold leading-none",
            highlight ? "text-brand" : "text-ink",
          )}
        >
          {Number.isNaN(parseInt(value, 10)) ? "—" : value}
        </span>
        <span className="text-[10px] text-ink-3">{unit}</span>
      </div>
      <span className="text-[10px] text-ink-3">
        {Number.isNaN(parseInt(value, 10)) ? "(≈ — XLM)" : `(≈ ${toXLM(value)} XLM)`}
      </span>
    </div>
  );
}
