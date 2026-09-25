import { Tick01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef, useState } from "react";

import { useSorokit } from "@/context/useSorokit";
import { cn, truncateAddress } from "@/lib/utils";

interface WalletStatusBadgeProps {
  className?: string;
  /** Called when the badge is clicked while connected */
  onOpen?: () => void;
}

/** How long the "Copied" confirmation stays visible after a click. */
const COPY_FEEDBACK_MS = 1600;

/**
 * Network health overrides for the connected-state indicator. A healthy
 * ("online") or unknown status keeps the default green dot. Each state also
 * carries a text label so it is never conveyed by colour alone.
 */
const networkStatusStyles = {
  degraded: {
    dot: "bg-orange motion-safe:animate-pulse",
    text: "text-orange",
    label: "Degraded",
  },
  offline: {
    dot: "bg-red",
    text: "text-red",
    label: "Offline",
  },
} as const;

type IndicatedNetworkStatus = keyof typeof networkStatusStyles;

function isIndicatedStatus(
  status: string | undefined,
): status is IndicatedNetworkStatus {
  return status === "degraded" || status === "offline";
}

export function WalletStatusBadge({
  className,
  onOpen,
}: WalletStatusBadgeProps) {
  const { address, walletName, isConnected, isConnecting, network } =
    useSorokit();
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    },
    [],
  );

  if (isConnecting) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 h-8 px-3 rounded-lg bg-surface-2 border border-line",
          className,
        )}
        role="status"
        aria-label="Connecting wallet"
      >
        <span
          aria-hidden="true"
          data-testid="wallet-status-dot"
          // motion-safe: the pulse only runs when the user has not asked the
          // OS to reduce motion — it also stops burning frames for them.
          className="w-2 h-2 rounded-full bg-orange motion-safe:animate-pulse shrink-0"
        />
        <span className="text-[12px] text-ink-3">Connecting…</span>
      </div>
    );
  }

  if (!isConnected || !address) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 h-8 px-3 rounded-lg bg-surface-2 border border-line",
          className,
        )}
        aria-label="Wallet disconnected"
      >
        <span
          aria-hidden="true"
          data-testid="wallet-status-dot"
          className="w-2 h-2 rounded-full bg-ink-4 shrink-0"
        />
        <span className="text-[12px] text-ink-3">Disconnected</span>
      </div>
    );
  }

  const networkStatus = isIndicatedStatus(network?.status)
    ? networkStatusStyles[network.status]
    : null;

  const handleClick = async () => {
    onOpen?.();
    try {
      // Throws synchronously when the Clipboard API is unavailable and rejects
      // when permission is denied — either way, skip the confirmation.
      await navigator.clipboard.writeText(address);
    } catch {
      return;
    }
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
  };

  const networkLabel = networkStatus
    ? ` Network ${networkStatus.label.toLowerCase()}.`
    : "";

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "inline-flex items-center gap-2 h-8 px-3 rounded-lg bg-surface-2 border border-line hover:border-line-2 transition-colors cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand",
          className,
        )}
        aria-label={`Wallet connected: ${walletName ?? "Unknown"}, ${address}.${networkLabel} Click to copy address${onOpen ? " and manage wallet" : ""}.`}
      >
        <span
          aria-hidden="true"
          data-testid="wallet-status-dot"
          className={cn(
            "w-2 h-2 rounded-full shrink-0",
            networkStatus?.dot ?? "bg-green",
          )}
        />
        <span className="text-[12px] font-medium text-ink">
          {walletName ?? "Wallet"}
        </span>
        {networkStatus && (
          <span
            aria-hidden="true"
            className={cn("text-[11px] font-medium", networkStatus.text)}
          >
            {networkStatus.label}
          </span>
        )}
        {copied ? (
          <span
            aria-hidden="true"
            data-testid="wallet-copy-confirmation"
            className="inline-flex items-center gap-1 text-[12px] text-green"
          >
            <HugeiconsIcon
              icon={Tick01Icon}
              size={12}
              color="currentColor"
              strokeWidth={2}
            />
            <span className="hidden sm:inline">Copied</span>
          </span>
        ) : (
          <span className="text-[12px] text-ink-3 font-mono hidden sm:inline">
            {truncateAddress(address)}
          </span>
        )}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Address copied to clipboard" : ""}
      </span>
    </>
  );
}
