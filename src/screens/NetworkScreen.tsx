import { Loading01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { InfoCell } from "@/components/ui/InfoCell";
import { useSorokit } from "@/context/useSorokit";
import type { NetworkName } from "@/lib/client";
import { cn } from "@/lib/utils";

const NETWORKS: {
  name: NetworkName;
  label: string;
  description: string;
  dot: string;
  badge: "success" | "warning" | "purple" | "default";
}[] = [
  {
    name: "mainnet",
    label: "Mainnet",
    description: "Public Global Stellar Network — real assets",
    dot: "bg-green",
    badge: "success",
  },
  {
    name: "testnet",
    label: "Testnet",
    description: "Test SDF Network — free test XLM via Friendbot",
    dot: "bg-orange",
    badge: "warning",
  },
  {
    name: "futurenet",
    label: "Futurenet",
    description: "Test SDF Future Network — bleeding edge features",
    dot: "bg-purple",
    badge: "purple",
  },
  {
    name: "localnet",
    label: "Localnet",
    description: "Local development network — requires local node",
    dot: "bg-ink-3",
    badge: "default",
  },
];

export function NetworkScreen() {
  const { network, switchNetwork } = useSorokit();
  const [switching, setSwitching] = useState<string | null>(null);
  const activeCardRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (activeCardRef.current) {
      activeCardRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [network?.name]);

  async function handleSwitchNetwork(networkName: string) {
    if (network?.name === networkName) return;
    setSwitching(networkName);
    try {
      await switchNetwork(networkName);
    } finally {
      setSwitching(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {network && (
        <div className="rounded-xl border border-line bg-surface overflow-hidden">
          <div className="px-6 py-4 border-b border-line">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">
              Active Network
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 divide-line">
            <InfoCell
              label="Name"
              value={network.name}
              className="sm:border-r sm:border-line"
            />
            <InfoCell
              label="Passphrase"
              value={network.passphrase}
              mono
              copyable
            />
            <InfoCell
              label="RPC URL"
              value={network.rpcUrl}
              mono
              copyable
              testable
              className="sm:border-t sm:border-r sm:border-line"
            />
            <InfoCell
              label="Horizon URL"
              value={network.horizonUrl}
              mono
              copyable
              testable
              className="sm:border-t sm:border-line"
            />
            <InfoCell
              label="Latest Ledger"
              value={
                typeof network.ledger === "number"
                  ? `#${network.ledger.toLocaleString()}`
                  : "—"
              }
              mono
              className="sm:border-t sm:border-r sm:border-line"
            />
            <InfoCell
              label="Status"
              value={network.status ?? "unknown"}
              className="sm:border-t sm:border-line"
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {NETWORKS.map((net) => {
          const isActive = network?.name === net.name;
          const isSwitching = switching === net.name;
          return (
            <button
              key={net.name}
              ref={isActive ? activeCardRef : null}
              onClick={() => {
                if (!isActive) handleSwitchNetwork(net.name);
              }}
              disabled={isActive || isSwitching}
              className={cn(
                "w-full text-left rounded-xl border px-6 py-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand active:bg-surface-3",
                isActive
                  ? "border-[rgba(86,69,212,0.35)] bg-brand-dim cursor-default ring-1 ring-brand"
                  : "border-line bg-surface hover:bg-surface-2 hover:border-line-2 cursor-pointer active:border-line-2",
              )}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <span
                    className={cn("w-2.5 h-2.5 rounded-full shrink-0", net.dot)}
                  />
                  <div>
                    <p className="text-[14px] font-medium text-ink">
                      {net.label}
                    </p>
                    <p className="text-[12px] text-ink-3 mt-0.5">
                      {net.description}
                    </p>
                  </div>
                </div>
                {isSwitching ? (
                  <HugeiconsIcon
                    icon={Loading01Icon}
                    size={20}
                    color="currentColor"
                    className="text-brand animate-spin"
                    strokeWidth={1.5}
                  />
                ) : (
                  isActive && (
                    <Badge variant={net.badge} dot>
                      Active
                    </Badge>
                  )
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
