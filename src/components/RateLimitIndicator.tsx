import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { useRateLimit } from "@/hooks/useRateLimit";
import { cn } from "@/lib/utils";

export interface RateLimitIndicatorProps {
  /**
   * Called when the user clicks "Pause". When omitted the button is hidden and
   * the banner only suggests pausing.
   */
  onPause?: () => void;
  /** Always render the usage meter, even below the warning threshold. */
  alwaysShow?: boolean;
  className?: string;
}

function formatSeconds(ms: number): string {
  return `${Math.max(1, Math.ceil(ms / 1000))}s`;
}

/**
 * Warns when API usage is trending toward the configured quota (#1162) and
 * clearly suggests pausing activity (polling, refreshes, batch actions) until
 * the window resets.
 */
export function RateLimitIndicator({
  onPause,
  alwaysShow = false,
  className,
}: RateLimitIndicatorProps) {
  const { count, limit, ratio, level, limited, resetsInMs, windowMs, threshold } =
    useRateLimit();
  // A dismissal only lasts for the current level, so a worsening state
  // (warning -> critical) re-appears.
  const [dismissedLevel, setDismissedLevel] = useState<string | null>(null);

  if (level === "ok" && !alwaysShow) return null;
  if (level !== "ok" && dismissedLevel === level) return null;

  const percent = Math.min(100, Math.round(ratio * 100));
  const windowLabel =
    windowMs % 60_000 === 0 ? `${windowMs / 60_000} min` : `${windowMs / 1000}s`;
  const critical = level === "critical";

  const headline = limited
    ? "The API is rate limiting you"
    : critical
      ? "API quota reached"
      : level === "warning"
        ? "Approaching API rate limit"
        : "API usage";

  return (
    <div
      role={level === "ok" ? "status" : "alert"}
      data-testid="rate-limit-indicator"
      data-level={level}
      className={cn(
        "flex flex-col gap-2 px-6 py-3 border-b shrink-0",
        critical
          ? "bg-error-dim-muted border-error-dim"
          : level === "warning"
            ? "bg-warning-dim border-warning-dim"
            : "bg-surface border-line",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p
            className={cn(
              "text-[12px] font-semibold",
              critical ? "text-red" : level === "warning" ? "text-warning" : "text-ink",
            )}
          >
            {headline} — {count} of {limit} calls in the last {windowLabel} ({percent}%)
          </p>
          {level !== "ok" && (
            <p className="text-[12px] text-ink-2 mt-0.5">
              We suggest pausing — stop auto-refreshing and avoid new requests
              for about {formatSeconds(resetsInMs)} until usage drops. Alerts
              start at {Math.round(threshold * 100)}% of the quota.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {level !== "ok" && onPause && (
            <Button variant="secondary" size="sm" onClick={onPause}>
              Pause
            </Button>
          )}
          {level !== "ok" && (
            <button
              type="button"
              onClick={() => setDismissedLevel(level)}
              aria-label="Dismiss rate limit warning"
              className="text-ink-3 hover:text-ink transition-colors"
            >
              <HugeiconsIcon
                icon={Cancel01Icon}
                size={12}
                color="currentColor"
                strokeWidth={2}
              />
            </button>
          )}
        </div>
      </div>
      <div
        role="progressbar"
        aria-label="API quota used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1 w-full rounded-full bg-surface-2 overflow-hidden"
      >
        <div
          className={cn(
            "h-full rounded-full transition-all",
            critical ? "bg-red" : level === "warning" ? "bg-orange" : "bg-green",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/** Lets the user choose the quota and the point at which the warning shows. */
export function RateLimitSettings({ className }: { className?: string }) {
  const { config, setConfig } = useRateLimit();

  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-surface overflow-hidden",
        className,
      )}
      data-testid="rate-limit-settings"
    >
      <div className="px-6 py-4 border-b border-line">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">
          API Rate Limit Warning
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-6 py-4">
        <label className="flex flex-col gap-1 text-[12px] text-ink-2">
          Quota (calls per {config.windowMs / 1000}s)
          <input
            type="number"
            min={1}
            value={config.limit}
            onChange={(e) => setConfig({ limit: Number(e.target.value) })}
            className="h-8 rounded-lg border border-line bg-surface-2 px-2 text-[12px] text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-ink-2">
          Warn at (% of quota)
          <input
            type="number"
            min={1}
            max={100}
            value={Math.round(config.threshold * 100)}
            onChange={(e) =>
              setConfig({ threshold: Number(e.target.value) / 100 })
            }
            className="h-8 rounded-lg border border-line bg-surface-2 px-2 text-[12px] text-ink"
          />
        </label>
      </div>
    </div>
  );
}
