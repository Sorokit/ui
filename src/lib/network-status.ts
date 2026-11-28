import type { NetworkInfo } from "./client";

export type NormalizedNetworkStatus =
  | "online"
  | "degraded"
  | "offline"
  | "unknown";

export function normalizeNetworkStatus(
  status?: string,
): NormalizedNetworkStatus {
  if (!status) return "unknown";
  const normalized = status.toLowerCase();
  if (normalized === "online") return "online";
  if (normalized === "degraded" || normalized === "warning") return "degraded";
  if (normalized === "offline" || normalized === "error") return "offline";
  return "unknown";
}

export function getNetworkStatusWarning(
  network: NetworkInfo | null,
): string | null {
  if (!network?.status) return null;

  const status = normalizeNetworkStatus(network.status);
  if (status === "online") return null;

  if (status === "degraded") {
    return `Network "${network.name}" is degraded. Some requests may be slow or fail; consider switching networks.`;
  }

  if (status === "offline") {
    return `Network "${network.name}" is offline. Transactions cannot be submitted; switch to another network.`;
  }

  return `Network "${network.name}" reports an unknown status ("${network.status}"). Consider switching networks.`;
}
