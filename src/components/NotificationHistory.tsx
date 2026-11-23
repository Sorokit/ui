import { X } from "lucide-react";
import { useState } from "react";

import type { NotificationEntry, ToastType } from "@/context/ToastContext";
import { cn } from "@/lib/utils";

type Filter = "all" | ToastType;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "error", label: "Errors" },
  { id: "warning", label: "Warnings" },
  { id: "success", label: "Success" },
  { id: "info", label: "Info" },
];

const DOT_CLASS: Record<ToastType, string> = {
  error: "bg-red",
  warning: "bg-yellow-500",
  success: "bg-green",
  info: "bg-brand",
};

interface NotificationHistoryProps {
  notifications: NotificationEntry[];
  onDismiss: (id: string) => void;
  onClear: () => void;
}

export function NotificationHistory({
  notifications,
  onDismiss,
  onClear,
}: NotificationHistoryProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const visible = notifications.filter(
    (item) => filter === "all" || item.type === filter,
  );

  return (
    <div className="py-3" data-testid="notification-history">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">
          Recent Activity
        </span>
        {notifications.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] font-medium text-brand hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      <div role="group" aria-label="Filter notifications" className="mb-2 flex flex-wrap gap-1">
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
            className={cn(
              "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
              filter === id ? "bg-brand-dim text-brand" : "text-ink-3 hover:bg-surface-2",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length > 0 ? (
        <ul className="divide-y divide-line">
          {visible.map((item) => {
            const time = new Date(item.timestamp);
            return (
              <li key={item.id} className="flex items-start gap-2 py-2.5">
                <span
                  aria-hidden="true"
                  className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", DOT_CLASS[item.type])}
                />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-[13px] font-medium">{item.title}</p>
                  {item.message && (
                    <p className="mt-1 break-words text-xs text-ink-3">{item.message}</p>
                  )}
                  <time dateTime={time.toISOString()} className="mt-1 block text-[10px] text-ink-4">
                    {time.toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                <button
                  type="button"
                  onClick={() => onDismiss(item.id)}
                  aria-label={`Dismiss notification: ${item.title}`}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink-3 hover:bg-surface-2 hover:text-ink"
                >
                  <X size={12} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="py-3 text-center text-xs text-ink-3">
          {notifications.length > 0 ? "No matching notifications" : "No recent activity"}
        </p>
      )}
    </div>
  );
}
