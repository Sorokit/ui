import { useState } from "react";
import { useSorokit } from "@/context/useSorokit";
import { AccountCard } from "@/components/AccountCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn, truncateAddress } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon, Tick01Icon } from "@hugeicons/core-free-icons";

export function WalletScreen() {
  const { address, isConnected, disconnectWallet, network } = useSorokit();

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-line bg-surface overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-line">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-full bg-brand-dim border-2 border-[rgba(86,69,212,0.25)] flex items-center justify-center text-[13px] font-bold text-brand shrink-0">
              {address ? address.slice(0, 2).toUpperCase() : "—"}
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2.5">
                <span className="text-[15px] font-semibold text-ink">
                  {isConnected ? "Connected" : "Not connected"}
                </span>
                <Badge variant={isConnected ? "success" : "default"} dot>
                  {isConnected ? "Active" : "Inactive"}
                </Badge>
              </div>
              {address && (
                <span data-address>{truncateAddress(address, 14, 6)}</span>
              )}
            </div>
          </div>
          {isConnected && (
            <Button variant="secondary" size="sm" onClick={disconnectWallet}>
              Disconnect
            </Button>
          )}
        </div>

        {/* Network info cells */}
        {network && (
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-line">
            <InfoCell label="Network" value={network.name} />
            <InfoCell label="RPC Endpoint" value={network.rpcUrl} mono copyable />
          </div>
        )}
      </div>

      <AccountCard />
    </div>
  );
}

function InfoCell({
  label,
  value,
  mono,
  copyable,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* fallback */
    }
  }

  return (
    <div className="px-6 py-4 flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">
        {label}
      </span>
      <div className="flex items-center gap-2 group">
        <span
          title={value}
          className={`text-[13px] text-ink-2 break-all ${mono ? "font-mono text-[12px]" : ""}`}
        >
          {value}
        </span>
        {copyable && (
          <button
            onClick={copy}
            aria-label={copied ? "Copied" : "Copy value"}
            className={cn(
              "shrink-0 p-1 rounded-md transition-all",
              copied
                ? "text-green bg-[rgba(34,197,94,0.1)]"
                : "text-ink-3 hover:text-ink-2 hover:bg-surface-2 opacity-50 hover:opacity-100",
            )}
            title={copied ? "Copied!" : "Copy value"}
          >
            <HugeiconsIcon
              icon={copied ? Tick01Icon : Copy01Icon}
              size={12}
              color="currentColor"
              strokeWidth={2}
            />
          </button>
        )}
      </div>
    </div>
  );
}
