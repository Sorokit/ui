import { formatCachedAge } from "@/lib/offline-cache";

import { Badge } from "./ui/Badge";

export interface OfflineBadgeProps {
  /** True when the browser is offline. */
  isOffline: boolean;
  /** True when the data on screen came from the local cache. */
  isCached?: boolean;
  /** Epoch ms the cached data was last synced, shown in the tooltip. */
  lastSyncedAt?: number | null;
  className?: string;
}

/**
 * Small "Offline" pill (#1163). Renders only when the browser is offline or
 * the data being shown is a cached copy, so it can be dropped next to any
 * data-bearing component without extra conditionals.
 */
export function OfflineBadge({
  isOffline,
  isCached = false,
  lastSyncedAt = null,
  className,
}: OfflineBadgeProps) {
  if (!isOffline && !isCached) return null;

  const label = isOffline ? "Offline" : "Cached";
  const title = `Showing last-known data (synced ${formatCachedAge(lastSyncedAt)}). It will refresh automatically when you reconnect.`;

  return (
    <Badge
      variant="warning"
      dot
      live
      title={title}
      data-testid="offline-badge"
      className={className}
    >
      {label}
    </Badge>
  );
}
