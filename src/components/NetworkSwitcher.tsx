import { ArrowDown01Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useState } from "react";

import { useSorokit } from "@/context/useSorokit";
import type { NetworkName } from "@/lib/client";
import { cn } from "@/lib/utils";

const NETWORKS: { name: NetworkName; label: string; dot: string }[] = [
  { name: "mainnet", label: "Mainnet", dot: "bg-green" },
  { name: "testnet", label: "Testnet", dot: "bg-orange" },
  { name: "futurenet", label: "Futurenet", dot: "bg-purple" },
  { name: "localnet", label: "Localnet", dot: "bg-ink-3" },
];

export function NetworkSwitcher() {
  const { network, switchNetwork } = useSorokit();
  const [isSwitching, setIsSwitching] = useState(false);
  const current = NETWORKS.find((n) => n.name === network?.name) ?? NETWORKS[1];

  const handleSelect = async (name: NetworkName) => {
    if (isSwitching) return;
    setIsSwitching(true);
    try {
      await switchNetwork(name);
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          disabled={isSwitching}
          className="inline-flex items-center gap-1.5 sm:gap-2 h-8 px-2 sm:px-3.5 rounded-lg bg-surface-2 border border-line hover:border-line-2 transition-colors cursor-pointer text-[12px] text-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span
            className={cn("w-1.5 h-1.5 rounded-full shrink-0", current.dot)}
          />
          <span className="hidden sm:inline">{current.label}</span>
          {isSwitching ? (
            <span className="ml-0.5 h-3 w-3 animate-spin rounded-full border-2 border-ink-2 border-t-transparent" />
          ) : (
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              size={10}
              color="currentColor"
              strokeWidth={2}
              className="opacity-40 ml-0.5"
            />
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={5}
          className="z-50 min-w-[160px] rounded-xl border border-line bg-surface p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
        >
          {NETWORKS.map((net) => (
            <DropdownMenu.Item
              key={net.name}
              disabled={isSwitching}
              onSelect={() => handleSelect(net.name)}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] cursor-pointer outline-none transition-colors",
                "focus:bg-surface-2 focus-visible:ring-2 focus-visible:ring-brand",
                network?.name === net.name
                  ? "bg-surface-2 text-ink font-medium"
                  : "text-ink-2 hover:bg-surface-2 hover:text-ink focus:text-ink",
              )}
            >
              <span
                className={cn("w-1.5 h-1.5 rounded-full shrink-0", net.dot)}
              />
              {net.label}
              {network?.name === net.name && (
                <HugeiconsIcon
                  icon={Tick01Icon}
                  size={12}
                  color="currentColor"
                  strokeWidth={2}
                  className="ml-auto"
                />
              )}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
