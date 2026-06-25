import { useCallback, useEffect, useRef, useState } from "react";
import { getClient } from "@/lib/client";
import { Badge } from "@/components/ui/Badge";
import { truncateAddress } from "@/lib/utils";
import type { ContractEvent } from "@/lib/client";
import { HugeiconsIcon } from "@hugeicons/react";
import { Refresh01Icon } from "@hugeicons/core-free-icons";

const EVENT_TYPE_VARIANT: Record<
  string,
  "success" | "warning" | "teal" | "purple" | "default"
> = {
  transfer: "teal",
  mint: "success",
  burn: "warning",
  approve: "purple",
};

function EventRow({ event }: { event: ContractEvent }) {
  const variant = EVENT_TYPE_VARIANT[event.type] ?? "default";
  const time = new Date(event.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="flex items-start gap-3 px-5 py-3.5 border-b border-line last:border-0">
      <div className="flex flex-col items-center gap-1 shrink-0 mt-0.5">
        <Badge variant={variant}>{event.type}</Badge>
        <span className="text-[10px] text-ink-4 font-mono">{time}</span>
      </div>
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">
            Ledger
          </span>
          <span className="text-[11px] text-ink-2 font-mono">
            {event.ledger}
          </span>
        </div>
        {event.topics.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {event.topics.map((t, i) => (
              <span
                key={i}
                className="text-[10px] font-mono text-ink-3 bg-surface-2 rounded px-1.5 py-0.5 border border-line"
              >
                {t.length > 20 ? truncateAddress(t, 8, 4) : t}
              </span>
            ))}
          </div>
        )}
        {event.value !== null && event.value !== undefined && (
          <pre className="text-[10px] font-mono text-ink-3 bg-surface-2 rounded-lg px-3 py-2 border border-line whitespace-pre-wrap break-all mt-0.5">
            {JSON.stringify(event.value, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

interface ContractEventFeedProps {
  contractId: string;
  /** Auto-poll interval in ms. 0 = manual only. */
  pollInterval?: number;
  limit?: number;
}

export function ContractEventFeed({
  contractId,
  pollInterval = 0,
  limit = 10,
}: ContractEventFeedProps) {
  const [events, setEvents] = useState<ContractEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(pollInterval > 0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!contractId.trim()) return;
    setLoading(true);
    try {
      const { data, error: err } = await getClient().soroban.getEvents(
        contractId,
        limit,
      );
      if (err) {
        setError(err);
        return;
      }
      setEvents(data ?? []);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [contractId, limit]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void load();
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [load]);

  useEffect(() => {
    if (live && pollInterval > 0) {
      intervalRef.current = setInterval(() => {
        void load();
      }, pollInterval);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [live, pollInterval, load]);

  return (
    <div className="rounded-xl border border-line bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <div>
          <h3 className="text-[14px] font-semibold text-ink">
            Contract Events
          </h3>
          <p className="text-[12px] text-ink-3 mt-0.5 font-mono">
            {truncateAddress(contractId, 10, 6)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pollInterval > 0 && (
            <button
              onClick={() => setLive((l) => !l)}
              aria-pressed={live}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${live ? "bg-success-dim text-green border-success-dim-strong" : "bg-surface-2 text-ink-3 border-line-2"}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${live ? "bg-green animate-pulse" : "bg-ink-3"}`}
              />
              {live ? "Live" : "Paused"}
            </button>
          )}
          <button
            onClick={() => void load()}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-surface-2 text-ink-3 hover:text-ink-2 transition-colors disabled:opacity-40"
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
      </div>

      {error ? (
        <p className="text-[13px] text-red text-center py-10">{error}</p>
      ) : loading && events.length === 0 ? (
        <div className="px-5 py-4 flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 rounded-lg bg-surface-2 animate-pulse"
            />
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="text-[13px] text-ink-3 text-center py-10">
          No events found
        </p>
      ) : (
        <div aria-live="polite">
          {events.map((e) => (
            <EventRow key={e.id} event={e} />
          ))}
        </div>
      )}
    </div>
  );
}
