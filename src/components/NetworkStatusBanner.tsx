import { Alert01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { useSorokit } from "@/context/useSorokit";
import type { NetworkName } from "@/lib/client";
import {
  getNetworkStatusWarning,
  normalizeNetworkStatus,
} from "@/lib/network-status";
import { cn } from "@/lib/utils";

const SWITCH_OPTIONS: Array<{ name: NetworkName; label: string }> = [
  { name: "mainnet", label: "Mainnet" },
  { name: "testnet", label: "Testnet" },
  { name: "futurenet", label: "Futurenet" },
  { name: "localnet", label: "Localnet" },
];

export interface NetworkStatusBannerProps {
  className?: string;
}

export function NetworkStatusBanner({
  className,
}: NetworkStatusBannerProps) {
  const {
    network,
    networkStatus,
    networkStatusWarning,
    switchNetwork,
    isSwitchingNetwork = false,
  } = useSorokit();

  const status = networkStatus ?? normalizeNetworkStatus(network?.status);
  if (!network || (status !== "degraded" && status !== "offline")) return null;

  const warning =
    networkStatusWarning ??
    getNetworkStatusWarning(network) ??
    `Network "${network.name}" is ${status}.`;
  const isOffline = status === "offline";
  const alternatives = SWITCH_OPTIONS.filter(
    (option) => option.name !== network.name,
  );

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="network-status-banner"
      data-status={status}
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-[11px] font-medium",
        isOffline
          ? "border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] text-red"
          : "border-[rgba(249,115,22,0.25)] bg-[rgba(249,115,22,0.08)] text-orange",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <HugeiconsIcon
          icon={Alert01Icon}
          size={14}
          color="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        />
        <span>{warning}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {alternatives.map((option) => (
          <button
            key={option.name}
            type="button"
            disabled={isSwitchingNetwork}
            onClick={() => void switchNetwork(option.name)}
            className="rounded-full border border-current px-2 py-0.5 text-[10px] font-semibold transition-colors hover:bg-black/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-current disabled:cursor-not-allowed disabled:opacity-50"
          >
            Switch to {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
