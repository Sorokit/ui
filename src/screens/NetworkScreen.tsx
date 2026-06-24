import { useSorokit } from "@/context/useSorokit";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { NetworkName } from "@/lib/client";

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

  return (
    <div className="flex flex-col gap-5">
      {/* Active network info */}
      {network && (
        <div className="rounded-xl border border-line bg-surface overflow-hidden">
          <div className="px-6 py-4 border-b border-line">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">
              Active Network
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 divide-line">
            <InfoCell label="Name" value={network.name} className="sm:border-r sm:border-line" />
            <InfoCell label="Passphrase" value={network.passphrase} mono />
            <InfoCell label="RPC URL" value={network.rpcUrl} mono className="sm:border-t sm:border-r sm:border-line" />
            <InfoCell label="Horizon URL" value={network.horizonUrl} mono className="sm:border-t sm:border-line" />
          </div>
        </div>
      )}

      {/* Selector */}
      <div className="flex flex-col gap-3">
        {NETWORKS.map((net) => {
          const isActive = network?.name === net.name;
          return (
            <button
              key={net.name}
              onClick={() => { if (!isActive) switchNetwork(net.name); }}
              disabled={isActive}
              className={cn(
                "w-full text-left rounded-xl border px-6 py-5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand",
                isActive
                  ? "border-[rgba(86,69,212,0.35)] bg-brand-dim cursor-default"
                  : "border-line bg-surface hover:bg-surface-2 hover:border-line-2 cursor-pointer",
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
                {isActive && (
                  <Badge variant={net.badge} dot>
                    Active
                  </Badge>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function InfoCell({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("px-6 py-4 flex flex-col gap-1.5", className)}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">
        {label}
      </span>
      <span
        className={cn(
          "text-[13px] text-ink-2 break-all",
          mono && "font-mono text-[12px]",
        )}
      >
        {value}
      </span>
    </div>
  );
}
